import type { NextApiRequest, NextApiResponse } from "next";
import { createRsvpApiHandler } from "../../../server/http/participant-lifecycle-handlers";
import { PrismaHackerLifecycleRepository } from "../../../server/repositories/prisma-hacker-lifecycle";
import { confirmRsvp } from "../../../server/services/hacker-lifecycle";
import { prisma } from "../../../server/db";
import { log } from "../../../server/lib/log";

const repository = new PrismaHackerLifecycleRepository(prisma);

const handler = createRsvpApiHandler(async id => {
	const result = await confirmRsvp(repository, id);
	if (!result.confirmed) return;

	await log(
		{ prisma },
		{
			sourceId: String(id),
			sourceType: "Hacker",
			author: "rsvp-link",
			route: "/api/rsvp/[id]",
			action: "ConfirmRsvp",
			details: "Confirmed RSVP and rotated the cancellation capability.",
		},
	);
});

export default function rsvp(req: NextApiRequest, res: NextApiResponse) {
	return handler(req, res);
}
