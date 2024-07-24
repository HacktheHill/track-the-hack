import NextAuth, { type NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import EmailProvider from "next-auth/providers/email";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

// Prisma adapter for NextAuth, optional and can be removed
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { env } from "../../../env/server.mjs";
import { prisma } from "../../../server/db";

import type { IncomingMessage } from "http";
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";

const getUser = async (email: string) =>
	await prisma.user.findFirst({
		where: {
			email,
		},
	});

export const getAuthOptions = (req: IncomingMessage) =>
	({
		// Include user.id on session
		callbacks: {
			async session({ session, user }) {
				const newSession = await prisma.user.findUnique({
					where: { id: user.id },
					select: {
						id: true,
						roles: {
							select: { name: true },
						},
						hackerInfo: {
							select: { id: true },
							take: 1,
						},
					},
				});

				return {
					...session,
					user: {
						...session.user,
						id: newSession?.id,
						roles: newSession?.roles.map(role => role.name),
						hackerId: newSession?.hackerInfo[0]?.id,
					},
				};
			},
			async signIn({ user, account, email }) {
				// Return false if account is null or if no email is provided
				if (!account || !user.email) {
					return false;
				}

				// Allow if there's an active session
				if (await getSession({ req })) {
					return true;
				}

				// Allow email verification requests
				if (account.provider === "email" && email?.verificationRequest) {
					return true;
				}

				// Check if the account already exists
				const existingAccount = await prisma.account.findFirst({
					where: {
						providerAccountId: account.providerAccountId,
					},
				});

				// Allow if the account already exists
				if (existingAccount) {
					return true;
				}

				// Fetch the user by email
				const existingUser = await getUser(user.email);

				// If the user doesn't exist, redirect to signup
				if (!existingUser) {
					return `/auth/sign-up?no-user=true&email=${encodeURIComponent(user.email)}`;
				}

				// Create account if user exists and account doesn't
				await prisma.account.create({
					data: {
						provider: account.provider,
						type: account.type,
						providerAccountId: account.providerAccountId,
						access_token: account.access_token,
						expires_at: account.expires_at,
						scope: account.scope,
						token_type: account.token_type,
						id_token: account.id_token,
						user: {
							connect: {
								email: user.email,
							},
						},
					},
				});

				// Add image and name during sign-in
				await prisma.user.update({
					where: { email: user.email },
					data: {
						name: user.name,
						image: user.image,
					},
				});

				return true;
			},
		},
		// Configure one or more authentication providers
		adapter: PrismaAdapter(prisma),
		providers: [
			DiscordProvider({
				clientId: env.DISCORD_CLIENT_ID,
				clientSecret: env.DISCORD_CLIENT_SECRET,
			}),
			GitHubProvider({
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
			}),
			GoogleProvider({
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
			}),
			EmailProvider({
				server: {
					host: env.EMAIL_SERVER_HOST,
					port: env.EMAIL_SERVER_PORT,
					auth: {
						user: env.EMAIL_SERVER_USER,
						pass: env.EMAIL_SERVER_PASSWORD,
					},
				},
				from: `Hack the Hill <${env.EMAIL_FROM}>`,
			}),
		],
		theme: {
			logo: "/assets/hackthehill-logo.svg",
			colorScheme: "light",
		},
		pages: {
			signIn: "/auth/sign-in",
			error: "/auth/error",
			verifyRequest: "/auth/verify-request",
		},
		session: {
			jwt: true,
		},
	}) as NextAuthOptions;

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
	await NextAuth(req, res, getAuthOptions(req));
}
