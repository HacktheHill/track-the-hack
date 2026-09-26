import { PrismaAdapter } from "@next-auth/prisma-adapter";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { getToken } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import {
	canUseDevelopmentOrganizerAuth,
	canUseGoogleOrganizerAuth,
	DEVELOPMENT_AUTH_PROVIDER_ID,
	DEVELOPMENT_ORGANIZER_EMAIL,
	getOrganizerAccess,
	isDevelopmentOrganizerAuthEnabled,
	isOrganizerEmailAllowed,
	normalizeOrganizerEmail,
	parseGoogleOrganizerProfile,
} from "@/server/lib/organizer-auth";
import { sendOrganizerVerificationRequest } from "@/server/lib/organizer-email";
import { restrictOrganizerVerificationTokens } from "@/server/lib/organizer-adapter";

export const getAuthOptions = (req?: NextApiRequest) =>
	({
		adapter: restrictOrganizerVerificationTokens(PrismaAdapter(prisma), prisma),
		callbacks: {
			async signIn({ user, account, profile, email }) {
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
				if (account?.provider === "email") {
					// The custom sender silently withholds mail for unknown addresses.
					// Redemption is checked again in case access changed after issuance.
					if (email?.verificationRequest) return true;
					return !!user.email && (await isOrganizerEmailAllowed(prisma, user.email));
				}
				const googleProfile = parseGoogleOrganizerProfile(profile);
				return canUseGoogleOrganizerAuth({
					provider: account?.provider,
					profileEmail: googleProfile?.email,
					userEmail: user.email,
					emailVerified: googleProfile?.emailVerified === true,
					hostedDomain: googleProfile?.hostedDomain,
				});
			},
			async session({ session, token }) {
				if (!token.sub) return { ...session, user: undefined };
				const organizer = await getOrganizerAccess(prisma, token.sub);

				return {
					...session,
					user: {
						...session.user,
						id: organizer?.id ?? token.sub,
						isOrganizer: organizer !== null,
						isAdmin: organizer?.isAdmin ?? false,
					},
				};
			},
		},
		providers: [
			GoogleProvider({
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				// Linking is safe here because signIn first requires a verified,
				// individually named CTN Workspace identity with matching emails.
				allowDangerousEmailAccountLinking: true,
			}),
			EmailProvider({
				server: {
					host: env.EMAIL_SERVER_HOST,
					port: env.EMAIL_SERVER_PORT,
					auth: { user: env.EMAIL_SERVER_USER, pass: env.EMAIL_SERVER_PASSWORD },
				},
				from: `Hack the Hill <${env.EMAIL_FROM}>`,
				maxAge: 15 * 60,
				normalizeIdentifier: normalizeOrganizerEmail,
				sendVerificationRequest: sendOrganizerVerificationRequest,
			}),
			...(isDevelopmentOrganizerAuthEnabled(process.env, req?.headers.host, req?.socket.remoteAddress)
				? [
						CredentialsProvider({
							id: DEVELOPMENT_AUTH_PROVIDER_ID,
							name: "Local development organiser",
							credentials: {},
							async authorize() {
								const organizer = await prisma.user.findUnique({
									where: { email: DEVELOPMENT_ORGANIZER_EMAIL },
									select: {
										id: true,
										email: true,
										name: true,
										image: true,
										isAdmin: true,
										disabledAt: true,
									},
								});
								if (!organizer?.email || organizer.disabledAt) return null;
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
	res.setHeader("Cache-Control", "no-store");
	await NextAuth(req, res, getAuthOptions(req));
}
