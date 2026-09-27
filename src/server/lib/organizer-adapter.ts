import type { Adapter } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";
import { isOrganizerEmailAllowed } from "@/server/lib/organizer-auth";
import { isJudgeEmailAllowed } from "@/server/lib/judge-auth";

type SignInAdapterPrisma = Pick<PrismaClient, "organizerAccess" | "judgingJudge">;

export const isSignInEmailAllowed = async (prisma: SignInAdapterPrisma, email: string) =>
	(await isOrganizerEmailAllowed(prisma, email)) || (await isJudgeEmailAllowed(prisma, email));

// NextAuth creates the verification token concurrently with invoking the email
// sender. Guarding both boundaries keeps the public response indistinguishable
// while ensuring an unknown address receives neither mail nor a retained token.
export const restrictOrganizerVerificationTokens = (adapter: Adapter, prisma: SignInAdapterPrisma): Adapter => ({
	...adapter,
	async createVerificationToken(token) {
		if (!(await isSignInEmailAllowed(prisma, token.identifier))) return null;
		if (!adapter.createVerificationToken) throw new Error("Verification tokens are unavailable");
		return adapter.createVerificationToken(token);
	},
});
