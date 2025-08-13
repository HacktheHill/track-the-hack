import { PrismaAdapter } from "@next-auth/prisma-adapter";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import EmailProvider from "next-auth/providers/email";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { getSession } from "next-auth/react";
import type { JWT } from "next-auth/jwt";

import type { IncomingMessage } from "http";
import type { NextApiRequest, NextApiResponse } from "next";
import argon2 from "argon2";

import { env } from "../../../env/server.mjs";
import { prisma } from "../../../server/db";

interface TokenWithMeta extends JWT {
	roles?: string[];
	hackerId?: string | null;
}

export const getAuthOptions = (req: IncomingMessage) =>
	({
		// Include user.id on session
		callbacks: {
			session({ session, token }) {
				const meta = token as TokenWithMeta;
				if (!token?.sub) return session;
				return {
					...session,
					user: {
						...session.user,
						id: token.sub,
						roles: meta.roles ?? [],
						hackerId: meta.hackerId,
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
				const existingUser = await prisma.user.findUnique({
					where: {
						email: user.email,
					},
				});

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
			async jwt({ token, user }) {
				const meta = token as TokenWithMeta;
				if (user) token.sub = user.id;
				if (meta.roles && meta.hackerId !== undefined) return token;
				if (token.sub) {
					try {
						const dbUser = await prisma.user.findUnique({
							where: { id: token.sub },
							select: { roles: { select: { name: true } }, Hacker: { select: { id: true } } },
						});
						meta.roles = dbUser?.roles.map(r => r.name) ?? [];
						meta.hackerId = dbUser?.Hacker?.id ?? null;
					} catch {
						// swallow
					}
				}
				return token;
			},
		},
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
			CredentialsProvider({
				credentials: {
					email: {
						type: "email",
					},
					password: {
						type: "password",
					},
				},
				async authorize(credentials) {
					if (!credentials || !credentials.email || !credentials.password) {
						return null;
					}

					const user = await prisma.user.findUnique({
						where: {
							email: credentials.email,
						},
					});

					if (user && user.passwordHash) {
						try {
							if (await argon2.verify(user.passwordHash, credentials.password)) {
								return {
									id: user.id,
									name: user.name,
									email: user.email,
								};
							} else {
								return null;
							}
						} catch (err) {
							console.error(err);
							return null;
						}
					}

					return null;
				},
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
			strategy: "jwt",
		},
	}) as NextAuthOptions;

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
	await NextAuth(req, res, getAuthOptions(req));
}
