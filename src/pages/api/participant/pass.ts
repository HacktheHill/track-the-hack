import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { readParticipantSession } from "@/server/lib/participant-session";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";

const repository = new PrismaHackerLifecycleRepository(prisma);

export default async function pass(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader("Cache-Control", "private, no-store");
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const session = await readParticipantSession(req, env.PARTICIPANT_SESSION_SECRET, (verifier, now) =>
			repository.findParticipantSession(verifier, now),
		);
		if (!session) return res.status(401).json({ error: "Participant session required" });

		// Return only the scanner identifier, never the session credential or profile.
		return res.status(200).json({ participantId: session.hackerId });
	} catch {
		return res.status(503).json({ error: "Pass temporarily unavailable" });
	}
}
