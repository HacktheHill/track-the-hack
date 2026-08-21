import type { NextApiRequest, NextApiResponse } from "next";
import { ZodError } from "zod";
import { env } from "../../env/server.mjs";
import { prisma } from "../../server/db";
import { log } from "../../server/lib/log";
import {
	createParticipantHintCookie,
	createParticipantSessionCookie,
	participantSessionExpiry,
} from "../../server/lib/participant-session";
import { PrismaHackerLifecycleRepository } from "../../server/repositories/prisma-hacker-lifecycle";
import { consumeClaimToken, ParticipantLifecycleError } from "../../server/services/hacker-lifecycle";

const repository = new PrismaHackerLifecycleRepository(prisma);

// No API key here, unlike the Sheet endpoints. The caller is an anonymous phone
// and the signed token is the credential.
export default async function claim(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader("Cache-Control", "no-store");
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ ok: false, message: "Scan the access code again to continue." });
	}

	try {
		const body = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
		const { hackerId } = await consumeClaimToken(repository, body.token, env.CLAIM_TOKEN_SECRET);

		res.setHeader("Set-Cookie", [
			createParticipantSessionCookie(hackerId, env.PARTICIPANT_SESSION_SECRET, participantSessionExpiry()),
			createParticipantHintCookie(),
		]);

		await log(
			{ prisma },
			{
				sourceId: hackerId,
				sourceType: "Hacker",
				author: "claim-token",
				route: "/api/claim",
				action: "ClaimParticipantAccess",
				details: "Exchanged a single-use claim token for a participant session.",
			},
		);

		return res.status(200).json({ ok: true });
	} catch (error) {
		if (error instanceof ParticipantLifecycleError || error instanceof ZodError) {
			// Spent, expired, forged and malformed all look the same from outside.
			return res.status(400).json({ ok: false, message: "This access code is no longer valid." });
		}

		// Do not include the exception here: it can carry the raw token.
		console.error("Participant claim failed");
		return res.status(500).json({ ok: false, message: "Access is temporarily unavailable." });
	}
}
