import { PrismaAdapter } from "@next-auth/prisma-adapter";
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "../../../env/server.mjs";
import { prisma } from "../../../server/db";
import { canUseOrganizerAuth } from "../../../server/lib/organizer-auth";

export const getAuthOptions = () =>
	({
		adapter: PrismaAdapter(prisma),
		callbacks: {
			async signIn({ user, account, profile }) {
				const googleProfile = profile as { email_verified?: boolean } | undefined;
				return canUseOrganizerAuth(
					{
						provider: account?.provider,
						email: user.email,
						emailVerified: googleProfile?.email_verified === true,
					},
					email =>
						prisma.user.findUnique({
							where: { email },
							select: { id: true, roles: { select: { name: true } } },
						}),
				);
			},
			async session({ session, token }) {
				const organizer = await prisma.user.findUnique({
					where: { id: token.sub },
					select: { id: true, roles: { select: { name: true } } },
				});

				return {
					...session,
					user: {
						...session.user,
						id: organizer?.id ?? token.sub ?? "",
						roles: organizer?.roles.map(role => role.name) ?? [],
					},
				};
			},
		},
		providers: [
			GoogleProvider({
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				// Linking is safe here because signIn first requires a verified domain
				// address that already belongs to a provisioned organizer User.
				allowDangerousEmailAccountLinking: true,
			}),
		],
		pages: { signIn: "/auth/sign-in", error: "/auth/error" },
		session: { strategy: "jwt" },
		theme: { logo: "/assets/hackthehill-logo.svg", colorScheme: "light" },
	}) satisfies NextAuthOptions;

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
	await NextAuth(req, res, getAuthOptions());
}
