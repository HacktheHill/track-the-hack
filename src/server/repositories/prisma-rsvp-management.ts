import type { PrismaClient } from "@prisma/client";
import { log } from "@/server/lib/log";
import { managedRsvpState, type RsvpManagementRepository } from "@/server/services/rsvp-management";

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
		return hacker ? managedRsvpState(hacker.confirmed, hacker.rsvpRespondedAt, hacker.acceptanceExpiry, now) : null;
	}

	async decide(capabilityId: string, attending: boolean, now: Date) {
		const decision = await this.prisma.$transaction(async transaction => {
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
			return {
				state: managedRsvpState(
					attending,
					shouldWrite ? now : hacker.rsvpRespondedAt,
					hacker.acceptanceExpiry,
					now,
				),
				sourceId: hacker.id,
				action: attending ? "ManageRsvpAttend" : "ManageRsvpDecline",
				details: shouldWrite
					? `Participant selected ${attending ? "attending" : "not attending"}.`
					: `Participant repeated ${attending ? "attending" : "not attending"}.`,
			};
		});

		if (decision === null || decision === "expired") return decision;

		// RSVP intent is authoritative; a logging outage must not roll back a participant's choice.
		await log(
			{ prisma: this.prisma },
			{
				sourceId: decision.sourceId,
				sourceType: "Hacker",
				author: "rsvp-management-capability",
				route: "/api/rsvp/manage",
				action: decision.action,
				details: decision.details,
			},
		);
		return decision.state;
	}
}
