import type { Adapter } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";
import { isOrganizerEmailAllowed } from "@/server/lib/organizer-auth";

type OrganizerAdapterPrisma = Pick<PrismaClient, "organizerAccess">;

// NextAuth creates the verification token concurrently with invoking the email
// sender. Guarding both boundaries keeps the public response indistinguishable
// while ensuring an unknown address receives neither mail nor a retained token.
export const restrictOrganizerVerificationTokens = (adapter: Adapter, prisma: OrganizerAdapterPrisma): Adapter => ({
	...adapter,
	async createVerificationToken(token) {
		if (!(await isOrganizerEmailAllowed(prisma, token.identifier))) return null;
		if (!adapter.createVerificationToken) throw new Error("Verification tokens are unavailable");
		return adapter.createVerificationToken(token);
	},
});
