import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { readParticipantSession } from "@/server/lib/participant-session";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";
import { completeDiscordVerification, discordVerificationBodySchema } from "@/server/services/discord-verification";

const repository = new PrismaHackerLifecycleRepository(prisma);
export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };

export default async function verifyDiscord(req: NextApiRequest, res: NextApiResponse) {
	res.setHeader("Cache-Control", "no-store");
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ status: "invalid" });
	}
	// JSON-only requests and an exact origin check prevent a cross-site form
	// from linking its owner's Discord account to someone else's session.
	if (
		req.headers["content-type"]?.split(";")[0]?.trim() !== "application/json" ||
		(req.headers.origin && req.headers.origin !== new URL(env.NEXTAUTH_URL).origin)
	) {
		return res.status(403).json({ status: "invalid" });
	}
	try {
		const session = await readParticipantSession(req, env.PARTICIPANT_SESSION_SECRET, (verifier, now) =>
			repository.findParticipantSession(verifier, now),
		);
		if (!session) return res.status(401).json({ status: "session-required" });
		const body = discordVerificationBodySchema.safeParse(req.body);
		if (!body.success) return res.status(400).json({ status: "invalid" });
		if (!env.DISCORD_BOT_URL || !env.INTERNAL_API_SECRET) {
			return res.status(503).json({ status: "unavailable" });
		}
		const status = await completeDiscordVerification(body.data.token, session.hackerId, {
			botUrl: env.DISCORD_BOT_URL,
			secret: env.INTERNAL_API_SECRET,
		});
		const code = { verified: 200, invalid: 400, conflict: 409, unavailable: 503 };
		return res.status(code[status]).json({ status });
	} catch {
		console.error("Discord verification failed");
		return res.status(503).json({ status: "unavailable" });
	}
}
