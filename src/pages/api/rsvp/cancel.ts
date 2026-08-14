import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "../../../env/server.mjs";
import { createCancellationApiHandler } from "../../../server/http/participant-lifecycle-handlers";
import { PrismaHackerLifecycleRepository } from "../../../server/repositories/prisma-hacker-lifecycle";
import { cancelRsvp } from "../../../server/services/hacker-lifecycle";
import { prisma } from "../../../server/db";
import { log } from "../../../server/lib/log";

const repository = new PrismaHackerLifecycleRepository(prisma);

const handler = createCancellationApiHandler(async token => {
	const result = await cancelRsvp(repository, token, env.CANCELLATION_TOKEN_SECRET);
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
