import { PrismaAdapter } from "@next-auth/prisma-adapter";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { getToken } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import {
	canUseDevelopmentOrganizerAuth,
	canUseOrganizerAuth,
	DEVELOPMENT_AUTH_PROVIDER_ID,
	DEVELOPMENT_ORGANIZER_EMAIL,
	isDevelopmentOrganizerAuthEnabled,
	parseGoogleOrganizerProfile,
} from "@/server/lib/organizer-auth";

export const getAuthOptions = (req?: NextApiRequest) =>
	({
		adapter: PrismaAdapter(prisma),
		callbacks: {
			async signIn({ user, account, profile }) {
				const sessionUserId = req ? (await getToken({ req, secret: env.NEXTAUTH_SECRET }))?.sub : undefined;
				if (account?.provider === DEVELOPMENT_AUTH_PROVIDER_ID) {
					return canUseDevelopmentOrganizerAuth(
						{
							provider: account.provider,
							userId: user.id,
							userEmail: user.email,
							sessionUserId,
						},
						process.env,
						req?.headers.host,
						req?.socket.remoteAddress,
					);
				}
				const googleProfile = parseGoogleOrganizerProfile(profile);
				return canUseOrganizerAuth(
					{
						provider: account?.provider,
						profileEmail: googleProfile?.email,
						userEmail: user.email,
						emailVerified: googleProfile?.emailVerified === true,
					},
					email =>
						prisma.user.findUnique({
							where: { email },
							select: { id: true, roles: { select: { name: true } } },
						}),
					sessionUserId,
				);
			},
			async session({ session, token }) {
				if (!token.sub) return { ...session, user: undefined };
				const organizer = await prisma.user.findUnique({
					where: { id: token.sub },
					select: { id: true, roles: { select: { name: true } } },
				});

				return {
					...session,
					user: {
						...session.user,
						id: organizer?.id ?? token.sub,
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
			...(isDevelopmentOrganizerAuthEnabled(process.env, req?.headers.host, req?.socket.remoteAddress)
				? [
						CredentialsProvider({
							id: DEVELOPMENT_AUTH_PROVIDER_ID,
							name: "Local development organizer",
							credentials: {},
							async authorize() {
								const organizer = await prisma.user.findUnique({
									where: { email: DEVELOPMENT_ORGANIZER_EMAIL },
									select: {
										id: true,
										email: true,
										name: true,
										image: true,
										roles: { select: { name: true } },
									},
								});
								if (!organizer?.email || organizer.roles.length === 0) return null;
								return {
									id: organizer.id,
									email: organizer.email,
									name: organizer.name,
									image: organizer.image,
								};
							},
						}),
					]
				: []),
		],
		pages: { signIn: "/auth/sign-in", error: "/auth/error" },
		session: { strategy: "jwt" },
		theme: { logo: "/assets/hackthehill-logo.svg", colorScheme: "light" },
	}) satisfies NextAuthOptions;

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
	await NextAuth(req, res, getAuthOptions(req));
}
