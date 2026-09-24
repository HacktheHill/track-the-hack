import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { createParticipantSignOutApiHandler } from "@/server/http/participant-lifecycle-handlers";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";

const repository = new PrismaHackerLifecycleRepository(prisma);

export default createParticipantSignOutApiHandler(
	verifier => repository.revokeParticipantSession(verifier),
	env.PARTICIPANT_SESSION_SECRET,
	new URL(env.NEXTAUTH_URL).origin,
);
