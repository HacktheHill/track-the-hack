import NextAuth, { type NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import AuthentikProvider from "next-auth/providers/authentik";

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
			style: { logo: "https://cdn.discordapp.com/attachments/1029229927335206933/1167882053652598804/HtH_Small_White_Logo.svg?ex=6574a7eb&is=656232eb&hm=d58ebc8a128dc922c1792e66649ebda81e23ab9c1cd7b8059a5e90ead10baa46&", bg: "#a8403f", text: "#fff" }
		})
	],
	theme: {
		logo: "/assets/hackthehill-logo.svg",
		colorScheme: "light",
	},
};

export default NextAuth(authOptions);
