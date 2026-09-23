import { randomBytes } from "node:crypto";
import { MealCategory, Prisma, type PrismaClient } from "@prisma/client";
import type { DietaryUpdate } from "@/server/services/dietary-reconciliation";
import type {
	HackerLifecycleRepository,
	NewParticipantSession,
	ProvisioningRecord,
} from "@/server/services/hacker-lifecycle";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

type ExistingRsvpState = {
	id: string;
	confirmed: boolean | number;
	rsvpRespondedAt: Date | null;
};

const sameDate = (left: Date | null, right: Date | null) =>
	left === null ? right === null : right !== null && left.getTime() === right.getTime();

export type HackerLifecycleLockingTransaction = {
	findCancellationCapabilityOwner(capabilityId: string): Promise<string | null>;
	lockHacker(id: string): Promise<boolean>;
	findLockedCancellationCapabilityId(hackerId: string): Promise<string | null>;
	updateHackerConfirmation(id: string, confirmed: boolean): Promise<void>;
};

export type HackerLifecycleTransactionRunner = <Result>(
	operation: (transaction: HackerLifecycleLockingTransaction) => Promise<Result>,
) => Promise<Result>;

const createTransactionRunner =
	(prisma: PrismaClient): HackerLifecycleTransactionRunner =>
	operation =>
		prisma.$transaction(async transaction =>
			operation({
				findCancellationCapabilityOwner: async capabilityId => {
					const capability = await transaction.cancellationCapability.findUnique({
						where: { id: capabilityId },
						select: { hackerId: true },
					});
					return capability?.hackerId ?? null;
				},
				lockHacker: async id => {
					const lockedHackers = await transaction.$queryRaw<Array<{ id: string }>>`
					SELECT id FROM \`Hacker\` WHERE id = ${id} FOR UPDATE
				`;
					return lockedHackers.length > 0;
				},
				findLockedCancellationCapabilityId: async hackerId => {
					const [capability] = await transaction.$queryRaw<Array<{ id: string }>>`
					SELECT id FROM \`CancellationCapability\` WHERE hackerId = ${hackerId} FOR UPDATE
				`;
					return capability?.id ?? null;
				},
				updateHackerConfirmation: async (id, confirmed) => {
					await transaction.hacker.update({ where: { id }, data: { confirmed, rsvpRespondedAt: new Date() } });
				},
			}),
		);

export class PrismaHackerLifecycleRepository implements HackerLifecycleRepository {
	constructor(
		private readonly prisma: PrismaClient,
		private readonly runLockingTransaction: HackerLifecycleTransactionRunner = createTransactionRunner(prisma),
	) {}

	async updateExistingMealCategories(participants: DietaryUpdate[]) {
		return this.prisma.$transaction(async transaction => {
			const ids = participants.map(participant => participant.id);
			const existing = await transaction.hacker.findMany({ where: { id: { in: ids } }, select: { id: true } });
			const present = new Set(existing.map(participant => participant.id));
			const missingIds = ids.filter(id => !present.has(id));
			if (missingIds.length) return { missingIds };

			for (const mealCategory of Object.values(MealCategory)) {
				const matching = participants.filter(participant => participant.mealCategory === mealCategory).map(participant => participant.id);
				if (matching.length) await transaction.hacker.updateMany({ where: { id: { in: matching } }, data: { mealCategory } });
			}
			return { missingIds: [] };
		}, { timeout: 30_000 });
	}

	async upsertProvisionedBatch(records: ProvisioningRecord[]) {
		await this.prisma.$transaction(
			async transaction => {
				const ids = [...new Set(records.map(record => record.id))].sort();
				const existingRsvpStates = ids.length === 0
					? []
					: await transaction.$queryRaw<ExistingRsvpState[]>(Prisma.sql`
						SELECT id, confirmed, rsvpRespondedAt
						FROM \`Hacker\`
						WHERE id IN (${Prisma.join(ids)})
						ORDER BY id
						FOR UPDATE
					`);

				for (const record of records) {
					await this.upsertProvisionedInTransaction(transaction, record);
					// Only the pre-event invitation process mints this capability. The
					// day-of pass action must not implicitly open an RSVP workflow.
					await transaction.cancellationCapability.upsert({
						where: { hackerId: record.id },
						create: { id: randomBytes(32).toString("base64url"), hackerId: record.id },
						update: {},
					});
				}

				if (existingRsvpStates.length > 0) {
					const after = await transaction.hacker.findMany({
						where: { id: { in: existingRsvpStates.map(state => state.id) } },
						select: { id: true, confirmed: true, rsvpRespondedAt: true },
					});
					const afterById = new Map(after.map(state => [state.id, state]));
					for (const before of existingRsvpStates) {
						const current = afterById.get(before.id);
						if (
							!current ||
							current.confirmed !== Boolean(before.confirmed) ||
							!sameDate(current.rsvpRespondedAt, before.rsvpRespondedAt)
						) {
							throw new Error(`Provisioning attempted to change RSVP state for ${before.id}`);
						}
					}
				}
			},
			{ timeout: 30_000 },
		);
	}

	private async upsertProvisionedInTransaction(
		transaction: TransactionClient | PrismaClient,
		record: ProvisioningRecord,
	) {
		await transaction.hacker.upsert({
			where: { id: record.id },
			create: {
				id: record.id,
				tShirtSize: record.tShirtSize,
				mealCategory: record.mealCategory,
				acceptanceExpiry: record.acceptanceExpiry,
				walkIn: record.walkIn ?? false,
			},
			update: {
				tShirtSize: record.tShirtSize,
				mealCategory: record.mealCategory,
				acceptanceExpiry: record.acceptanceExpiry,
				...(record.walkIn === undefined ? {} : { walkIn: record.walkIn }),
			},
		});
	}

	async cancelByCapability(capabilityId: string) {
		return this.runLockingTransaction(async transaction => {
			const hackerId = await transaction.findCancellationCapabilityOwner(capabilityId);
			if (!hackerId) return null;

			// Match RSVP decision's Hacker-first lock order, then reject a capability
			// replaced while this lock waited.
			if (!(await transaction.lockHacker(hackerId))) return null;

			const activeCapabilityId = await transaction.findLockedCancellationCapabilityId(hackerId);
			if (activeCapabilityId !== capabilityId) return null;

			await transaction.updateHackerConfirmation(hackerId, false);
			return hackerId;
		});
	}

	async replaceParticipantAccess(record: ProvisioningRecord, claimId: string, expiresAt: Date) {
		await this.prisma.$transaction(async transaction => {
			// Keep the Phase 1 upsert semantics: operational fields are refreshed,
			// while RSVP confirmation and every unrelated relation are preserved.
			await this.upsertProvisionedInTransaction(transaction, record);

			// One claim and one session per participant. Both changes commit with
			// provisioning, so replacement access cannot leave the old phone live.
			await transaction.claimToken.upsert({
				where: { hackerId: record.id },
				create: { id: claimId, hackerId: record.id, expiresAt },
				update: { id: claimId, expiresAt, consumedAt: null },
			});
			await transaction.participantSession.deleteMany({ where: { hackerId: record.id } });
		});
	}

	async redeemClaimToken(claimId: string, now: Date, session: NewParticipantSession) {
		return this.prisma.$transaction(async transaction => {
			// The conditions live in the UPDATE rather than a read followed by a
			// write, so two devices scanning at once cannot both be handed a
			// session. Whoever gets count 1 won.
			const redeemed = await transaction.claimToken.updateMany({
				where: { id: claimId, consumedAt: null, expiresAt: { gt: now } },
				data: { consumedAt: now },
			});

			if (redeemed.count === 0) return null;

			const claim = await transaction.claimToken.findUnique({
				where: { id: claimId },
				select: { hackerId: true },
			});
			if (!claim) {
				throw new Error("Consumed claim disappeared during redemption");
			}

			await transaction.participantSession.deleteMany({ where: { hackerId: claim.hackerId } });
			await transaction.participantSession.create({
				data: {
					verifier: session.verifier,
					hackerId: claim.hackerId,
					expiresAt: session.expiresAt,
				},
			});

			return claim.hackerId;
		});
	}

	async findParticipantSession(verifier: string, now: Date) {
		return this.prisma.participantSession.findFirst({
			where: { verifier, expiresAt: { gt: now } },
			select: { verifier: true, hackerId: true, expiresAt: true },
		});
	}

	async revokeParticipantSession(verifier: string) {
		await this.prisma.participantSession.deleteMany({ where: { verifier } });
	}

	async reconcile(ids: string[]) {
		const hackers = await this.prisma.hacker.findMany({
			where: { id: { in: ids } },
			select: {
				id: true,
				confirmed: true,
				rsvpRespondedAt: true,
				cancellationCapability: { select: { id: true } },
			},
		});

		return hackers.map(hacker => ({
			id: hacker.id,
			confirmed: hacker.confirmed,
			rsvpRespondedAt: hacker.rsvpRespondedAt,
			cancellationCapabilityId: hacker.cancellationCapability?.id ?? null,
		}));
	}
}
