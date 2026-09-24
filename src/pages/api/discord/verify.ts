import { ScannerWorkflow } from "@prisma/client";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { createDiscordVerificationHandler } from "@/server/http/discord-verification-handler";
import { readParticipantSession } from "@/server/lib/participant-session";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";
import { completeDiscordVerification } from "@/server/services/discord-verification";

const repository = new PrismaHackerLifecycleRepository(prisma);
const discordConfig =
	env.DISCORD_BOT_URL && env.INTERNAL_API_SECRET
		? { botUrl: env.DISCORD_BOT_URL, secret: env.INTERNAL_API_SECRET }
		: null;
export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };

export default createDiscordVerificationHandler({
	expectedOrigin: new URL(env.NEXTAUTH_URL).origin,
	configured: discordConfig !== null,
	readParticipantSession: request =>
		readParticipantSession(request, env.PARTICIPANT_SESSION_SECRET, (verifier, now) =>
			repository.findParticipantSession(verifier, now),
		),
	hasCheckedIn: async hackerId =>
		Boolean(
			await prisma.presence.findFirst({
				where: {
					hackerId,
					value: { gt: 0 },
					event: { scannerWorkflow: ScannerWorkflow.CHECK_IN },
				},
				select: { id: true },
			}),
		),
	complete: (token, hackerId) =>
		discordConfig ? completeDiscordVerification(token, hackerId, discordConfig) : Promise.resolve("unavailable"),
});
