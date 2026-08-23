import type { PrismaClient } from "@prisma/client";
import type {
	ConfirmationResult,
	HackerLifecycleRepository,
	NewParticipantSession,
	ProvisioningRecord,
} from "@/server/services/hacker-lifecycle";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class PrismaHackerLifecycleRepository implements HackerLifecycleRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async upsertProvisioned(record: ProvisioningRecord) {
		await this.upsertProvisionedInTransaction(this.prisma, record);
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
		return this.prisma.$transaction(async transaction =>
			this.confirmInTransaction(transaction, id, now, cancellationCapabilityId),
		);
	}

	private async confirmInTransaction(
		transaction: TransactionClient,
		id: string,
		now: Date,
		cancellationCapabilityId: string,
	): Promise<ConfirmationResult> {
		const [hacker] = await transaction.$queryRaw<Array<{ acceptanceExpiry: Date }>>`
			SELECT acceptanceExpiry FROM \`Hacker\` WHERE id = ${id} FOR UPDATE
		`;
		if (!hacker) return "missing";
		if (hacker.acceptanceExpiry.getTime() <= now.getTime()) return "expired";

		await transaction.hacker.update({ where: { id }, data: { confirmed: true } });
		await transaction.cancellationCapability.upsert({
			where: { hackerId: id },
			create: { id: cancellationCapabilityId, hackerId: id },
			update: { id: cancellationCapabilityId },
		});
		return "confirmed";
	}

	async cancelByCapability(capabilityId: string) {
		return this.prisma.$transaction(async transaction => {
			const capability = await transaction.cancellationCapability.findUnique({
				where: { id: capabilityId },
				select: { hackerId: true },
			});

			if (!capability) return null;

			// Confirmation locks the Hacker before rotating its capability. Match
			// that order, then reject a capability replaced while this lock waited.
			const lockedHackers = await transaction.$queryRaw<Array<{ id: string }>>`
				SELECT id FROM \`Hacker\` WHERE id = ${capability.hackerId} FOR UPDATE
			`;
			if (lockedHackers.length === 0) return null;

			const [activeCapability] = await transaction.$queryRaw<Array<{ id: string }>>`
				SELECT id FROM \`CancellationCapability\` WHERE hackerId = ${capability.hackerId} FOR UPDATE
			`;
			if (activeCapability?.id !== capabilityId) return null;

			await transaction.hacker.update({
				where: { id: capability.hackerId },
				data: { confirmed: false },
			});
			return capability.hackerId;
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
