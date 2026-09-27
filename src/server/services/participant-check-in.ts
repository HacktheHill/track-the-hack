import { randomUUID } from "node:crypto";
import { ScannerWorkflow } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { createAuditEvent, persistAuditEvent, type AuditEventV1 } from "@/server/lib/audit-event";

type CheckInPrisma = Pick<PrismaClient, "$executeRaw" | "auditEvent" | "event" | "presence">;

export type CheckInEvidenceSource = "participant_pass_issued" | "participant_presence";

export class CanonicalCheckInEventError extends Error {
	constructor(readonly eventCount: number) {
		super(`Expected exactly one visible CHECK_IN event; found ${eventCount}`);
		this.name = "CanonicalCheckInEventError";
	}
}

export const ensureParticipantCheckedIn = async (
	prisma: CheckInPrisma,
	hackerId: string,
	input: {
		actor: AuditEventV1["actor"];
		correlationId?: string;
		evidenceSource: CheckInEvidenceSource;
		sourceEventId?: string;
	},
) => {
	const checkInEvents = await prisma.event.findMany({
		where: { hidden: false, scannerWorkflow: ScannerWorkflow.CHECK_IN },
		orderBy: { start: "asc" },
		take: 2,
		select: { id: true, name: true },
	});
	const checkInEvent = checkInEvents[0];
	if (!checkInEvent || checkInEvents.length !== 1) throw new CanonicalCheckInEventError(checkInEvents.length);

	const candidatePresenceId = randomUUID();
	const affected = await prisma.$executeRaw`
		INSERT INTO \`Presence\` (\`id\`, \`value\`, \`label\`, \`hackerId\`, \`eventId\`)
		VALUES (${candidatePresenceId}, 1, ${checkInEvent.name}, ${hackerId}, ${checkInEvent.id})
		ON DUPLICATE KEY UPDATE \`value\` = GREATEST(\`value\`, 1)
	`;
	const presence = await prisma.presence.findUniqueOrThrow({
		where: { hackerId_eventId: { hackerId, eventId: checkInEvent.id } },
		select: { id: true, value: true },
	});
	const recordedNow = affected > 0;

	if (recordedNow) {
		await persistAuditEvent(
			prisma,
			createAuditEvent({
				name: "participant.check_in.inferred",
				outcome: "recorded",
				actor: input.actor,
				subject: { type: "hacker", id: hackerId },
				resource: { type: "event", id: checkInEvent.id },
				correlationId: input.correlationId,
				data: {
					evidenceSource: input.evidenceSource,
					presenceId: presence.id,
					...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
				},
			}),
		);
	}

	return { eventId: checkInEvent.id, presenceId: presence.id, value: presence.value, recordedNow };
};
