// @ts-check
import { z } from "zod";

/**
 * Specify your server-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 */
export const serverSchema = z.object({
	DATABASE_URL: z.string().url(),
	NODE_ENV: z.enum(["development", "test", "production"]),
	NEXTAUTH_SECRET: process.env.NODE_ENV === "production" ? z.string().min(1) : z.string().min(1).optional(),
	NEXTAUTH_URL: z.preprocess(
		// This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
		// Since NextAuth.js automatically uses the VERCEL_URL if present.
		str => process.env.VERCEL_URL ?? str,
		// VERCEL_URL doesn't include `https` so it cant be validated as a URL
		process.env.VERCEL ? z.string() : z.string().url(),
	),
	DISCORD_CLIENT_ID: z.string(),
	DISCORD_CLIENT_SECRET: z.string(),
	GITHUB_CLIENT_ID: z.string(),
	GITHUB_CLIENT_SECRET: z.string(),
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
	EMAIL_SERVER_HOST: z.string(),
	EMAIL_SERVER_PORT: z.number(),
	EMAIL_SERVER_USER: z.string(),
	EMAIL_SERVER_PASSWORD: z.string(),
	EMAIL_FROM: z.string().email(),
	SPONSORSHIP_GOOGLE_CLIENT_ID: z.string(),
	SPONSORSHIP_GOOGLE_CLIENT_SECRET: z.string(),
	SPONSORSHIP_GOOGLE_REFRESH_TOKEN: z.string(),
	S3_URL: z.string().url(),
	S3_AUTH_KEY: z.string(),
	DISCORD_BOT_SECRET_KEY: z.string(),
	DISCORD_BOT_URL: z.string().url(),
	QR_SECRET_KEY: z.string(),
	WALK_IN_SECRET_KEY: z.string(),
});

/**
 * You can't destruct `process.env` as a regular object in the Next.js
 * middleware, so you have to do it manually here.
 * @type {{ [k in keyof z.infer<typeof serverSchema>]: z.infer<typeof serverSchema>[k] | undefined }}
 */
export const serverEnv = {
	DATABASE_URL: process.env.DATABASE_URL,
	NODE_ENV: process.env.NODE_ENV,
	NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
	NEXTAUTH_URL: process.env.NEXTAUTH_URL,
	DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
	GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
	EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT && parseInt(process.env.EMAIL_SERVER_PORT) || undefined,
	EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
	EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
	EMAIL_FROM: process.env.EMAIL_FROM,
	SPONSORSHIP_GOOGLE_CLIENT_ID: process.env.SPONSORSHIP_GOOGLE_CLIENT_ID,
	SPONSORSHIP_GOOGLE_CLIENT_SECRET: process.env.SPONSORSHIP_GOOGLE_CLIENT_SECRET,
	SPONSORSHIP_GOOGLE_REFRESH_TOKEN: process.env.SPONSORSHIP_GOOGLE_REFRESH_TOKEN,
	S3_URL: process.env.S3_URL,
	S3_AUTH_KEY: process.env.S3_AUTH_KEY,
	DISCORD_BOT_SECRET_KEY: process.env.DISCORD_BOT_SECRET_KEY,
	DISCORD_BOT_URL: process.env.DISCORD_BOT_URL,
	QR_SECRET_KEY: process.env.QR_SECRET_KEY,
	WALK_IN_SECRET_KEY: process.env.WALK_IN_SECRET_KEY,
};

/**
 * Specify your client-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 * To expose them to the client, prefix them with `NEXT_PUBLIC_`.
 */
export const clientSchema = z.object({
	// Public date-time (ISO string) when applications open. Example: "2025-09-15T17:00:00Z"
	NEXT_PUBLIC_APPLICATIONS_OPEN_AT: z.string().optional(),
});

/**
 * You can't destruct `process.env` as a regular object, so you have to do
 * it manually here. This is because Next.js evaluates this at build time,
 * and only used environment variables are included in the build.
 * @type {{ [k in keyof z.infer<typeof clientSchema>]: z.infer<typeof clientSchema>[k] | undefined }}
 */
export const clientEnv = {
	NEXT_PUBLIC_APPLICATIONS_OPEN_AT: process.env.NEXT_PUBLIC_APPLICATIONS_OPEN_AT,
};
