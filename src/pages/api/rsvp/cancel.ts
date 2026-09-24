import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/env/server.mjs";
import { createCancellationApiHandler } from "@/server/http/participant-lifecycle-handlers";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";
import { cancelRsvp } from "@/server/services/hacker-lifecycle";
import { prisma } from "@/server/db";
import { log } from "@/server/lib/log";
import { createAuditEvent, emitAuditEvent } from "@/server/lib/audit-event";

const repository = new PrismaHackerLifecycleRepository(prisma);

const handler = createCancellationApiHandler(async token => {
	const result = await cancelRsvp(repository, token, env.CANCELLATION_TOKEN_SECRET, (id, occurredAt) =>
		createAuditEvent({
			name: "participant.rsvp.cancelled",
			outcome: "cancelled",
			actor: { type: "participant", id },
			subject: { type: "hacker", id },
			data: {},
			occurredAt,
		}),
	);
	if (!result.auditEvent) throw new Error("RSVP cancellation audit event missing");
	emitAuditEvent(result.auditEvent);
	await log(
		{ prisma },
		{
			sourceId: result.participantId,
			sourceType: "Hacker",
			author: "cancellation-capability",
			route: "/api/rsvp/cancel",
			action: "CancelRsvp",
			details: "Cancelled RSVP using the active cancellation capability.",
		},
	);
});

export default function cancellation(req: NextApiRequest, res: NextApiResponse) {
	return handler(req, res);
}
