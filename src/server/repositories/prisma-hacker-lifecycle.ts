import type { PrismaClient } from "@prisma/client";
import type { ConfirmationResult, HackerLifecycleRepository, ProvisioningRecord } from "../services/hacker-lifecycle";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class PrismaHackerLifecycleRepository implements HackerLifecycleRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async upsertProvisioned(record: ProvisioningRecord) {
		await this.prisma.hacker.upsert({
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
		const hacker = await transaction.hacker.findUnique({
			where: { id },
			select: { acceptanceExpiry: true },
		});

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
			await transaction.hacker.update({
				where: { id: capability.hackerId },
				data: { confirmed: false },
			});
			return capability.hackerId;
		});
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
