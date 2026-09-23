import type { PrismaClient } from "@prisma/client";
import {
	managedRsvpState,
	type RsvpManagementRepository,
} from "@/server/services/rsvp-management";

export class PrismaRsvpManagementRepository implements RsvpManagementRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async read(capabilityId: string, now: Date) {
		const capability = await this.prisma.cancellationCapability.findUnique({
			where: { id: capabilityId },
			select: {
				hacker: { select: { confirmed: true, rsvpRespondedAt: true, acceptanceExpiry: true } },
			},
		});
		const hacker = capability?.hacker;
		return hacker
			? managedRsvpState(hacker.confirmed, hacker.rsvpRespondedAt, hacker.acceptanceExpiry, now)
			: null;
	}

	async decide(capabilityId: string, attending: boolean, now: Date) {
		return this.prisma.$transaction(async transaction => {
			const capability = await transaction.cancellationCapability.findUnique({
				where: { id: capabilityId },
				select: { hackerId: true },
			});
			if (!capability) return null;

			const [hacker] = await transaction.$queryRaw<
				Array<{ id: string; confirmed: number | boolean; rsvpRespondedAt: Date | null; acceptanceExpiry: Date }>
			>`SELECT id, confirmed, rsvpRespondedAt, acceptanceExpiry FROM \`Hacker\` WHERE id = ${capability.hackerId} FOR UPDATE`;
			if (!hacker) return null;
			const active = await transaction.cancellationCapability.findUnique({
				where: { hackerId: hacker.id },
				select: { id: true },
			});
			if (active?.id !== capabilityId) return null;
			if (attending && hacker.acceptanceExpiry.getTime() <= now.getTime()) return "expired" as const;

			const confirmed = Boolean(hacker.confirmed);
			const shouldWrite = confirmed !== attending || hacker.rsvpRespondedAt === null;
			if (shouldWrite) {
				await transaction.hacker.update({
					where: { id: hacker.id },
					data: { confirmed: attending, rsvpRespondedAt: now },
				});
			}
			return managedRsvpState(attending, shouldWrite ? now : hacker.rsvpRespondedAt, hacker.acceptanceExpiry, now);
		});
	}
}
