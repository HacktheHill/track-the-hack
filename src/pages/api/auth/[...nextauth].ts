import NextAuth, { type NextAuthOptions } from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";
import DiscordProvider from "next-auth/providers/discord";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

// Prisma adapter for NextAuth, optional and can be removed
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { env } from "../../../env/server.mjs";
import { prisma } from "../../../server/db";

export const authOptions: NextAuthOptions = {
	// Include user.id on session
	callbacks: {
		session({ session, user }) {
			if (session.user) {
				session.user.id = user.id;
			}
			return session;
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
		AuthentikProvider({
			name: "Hack The Hill",
			clientId: env.AUTHENTIK_ID,
			clientSecret: env.AUTHENTIK_SECRET,
			issuer: env.AUTHENTIK_ISSUER,
			style: { logo: "https://hackthehill.com/Logos/hackthehill-logo.svg", bg: "#a8403f", text: "#fff" },
		}),
	],
	theme: {
		logo: "/assets/hackthehill-logo.svg",
		colorScheme: "light",
	},
};

export default NextAuth(authOptions);
