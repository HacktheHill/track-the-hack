import type { PrismaClient } from "@prisma/client";
import type {
	ConfirmationResult,
	HackerLifecycleRepository,
	NewParticipantSession,
	ProvisioningRecord,
} from "@/server/services/hacker-lifecycle";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type HackerLifecycleLockingTransaction = {
	findLockedAcceptanceExpiry(id: string): Promise<Date | null>;
	findCancellationCapabilityOwner(capabilityId: string): Promise<string | null>;
	lockHacker(id: string): Promise<boolean>;
	findLockedCancellationCapabilityId(hackerId: string): Promise<string | null>;
	updateHackerConfirmation(id: string, confirmed: boolean): Promise<void>;
	rotateCancellationCapability(hackerId: string, capabilityId: string): Promise<void>;
};

export type HackerLifecycleTransactionRunner = <Result>(
	operation: (transaction: HackerLifecycleLockingTransaction) => Promise<Result>,
) => Promise<Result>;

const createTransactionRunner =
	(prisma: PrismaClient): HackerLifecycleTransactionRunner =>
	operation =>
		prisma.$transaction(async transaction =>
			operation({
				findLockedAcceptanceExpiry: async id => {
					const [hacker] = await transaction.$queryRaw<Array<{ acceptanceExpiry: Date }>>`
					SELECT acceptanceExpiry FROM \`Hacker\` WHERE id = ${id} FOR UPDATE
				`;
					return hacker?.acceptanceExpiry ?? null;
				},
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
					await transaction.hacker.update({ where: { id }, data: { confirmed } });
				},
				rotateCancellationCapability: async (hackerId, capabilityId) => {
					await transaction.cancellationCapability.upsert({
						where: { hackerId },
						create: { id: capabilityId, hackerId },
						update: { id: capabilityId },
					});
				},
			}),
		);

export class PrismaHackerLifecycleRepository implements HackerLifecycleRepository {
	constructor(
		private readonly prisma: PrismaClient,
		private readonly runLockingTransaction: HackerLifecycleTransactionRunner = createTransactionRunner(prisma),
	) {}

	async upsertProvisionedBatch(records: ProvisioningRecord[]) {
		await this.prisma.$transaction(
			async transaction => {
				for (const record of records) {
					await this.upsertProvisionedInTransaction(transaction, record);
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

	async confirmAndRotate(id: string, now: Date, cancellationCapabilityId: string) {
		return this.runLockingTransaction(async transaction =>
			this.confirmInTransaction(transaction, id, now, cancellationCapabilityId),
		);
	}

	private async confirmInTransaction(
		transaction: HackerLifecycleLockingTransaction,
		id: string,
		now: Date,
		cancellationCapabilityId: string,
	): Promise<ConfirmationResult> {
		const acceptanceExpiry = await transaction.findLockedAcceptanceExpiry(id);
		if (!acceptanceExpiry) return "missing";
		if (acceptanceExpiry.getTime() <= now.getTime()) return "expired";

		await transaction.updateHackerConfirmation(id, true);
		await transaction.rotateCancellationCapability(id, cancellationCapabilityId);
		return "confirmed";
	}

	async cancelByCapability(capabilityId: string) {
		return this.runLockingTransaction(async transaction => {
			const hackerId = await transaction.findCancellationCapabilityOwner(capabilityId);
			if (!hackerId) return null;

			// Confirmation locks the Hacker before rotating its capability. Match
			// that order, then reject a capability replaced while this lock waited.
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
				cancellationCapability: { select: { id: true } },
			},
		});

		return hackers.map(hacker => ({
			id: hacker.id,
			confirmed: hacker.confirmed,
			cancellationCapabilityId: hacker.cancellationCapability?.id ?? null,
		}));
	}
}
