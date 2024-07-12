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
	EMAIL_SERVER_PORT: z.string(),
	EMAIL_SERVER_USER: z.string(),
	EMAIL_SERVER_PASSWORD: z.string(),
	EMAIL_FROM: z.string().email(),
	STRIPE_SECRET_KEY: z.string(),
	STRIPE_WEBHOOKS_ID: z.string(),
	SPONSORSHIP_GOOGLE_CLIENT_ID: z.string(),
	SPONSORSHIP_GOOGLE_CLIENT_SECRET: z.string(),
	SPONSORSHIP_GOOGLE_REFRESH_TOKEN: z.string(),
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
	EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
	EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
	EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
	EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
	EMAIL_FROM: process.env.EMAIL_FROM,
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
	STRIPE_WEBHOOKS_ID: process.env.STRIPE_WEBHOOKS_ID,
	SPONSORSHIP_GOOGLE_CLIENT_ID: process.env.SPONSORSHIP_GOOGLE_CLIENT_ID,
	SPONSORSHIP_GOOGLE_CLIENT_SECRET: process.env.SPONSORSHIP_GOOGLE_CLIENT_SECRET,
	SPONSORSHIP_GOOGLE_REFRESH_TOKEN: process.env.SPONSORSHIP_GOOGLE_REFRESH_TOKEN,
};

/**
 * Specify your client-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 * To expose them to the client, prefix them with `NEXT_PUBLIC_`.
 */
export const clientSchema = z.object({
	NEXT_PUBLIC_STRIPE_REDIRECT_URL: z.string().url(),
	NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
	NEXT_PUBLIC_PRICE_ID_STARTUP: z.string(),
	NEXT_PUBLIC_PRICE_ID_CUSTOM: z.string(),
	NEXT_PUBLIC_PRICE_ID_MAYOR: z.string(),
	NEXT_PUBLIC_PRICE_ID_PREMIER: z.string(),
	NEXT_PUBLIC_PRICE_ID_GOVERNOR: z.string(),
	NEXT_PUBLIC_PRICE_ID_PRIME_MINISTER: z.string(),
});

/**
 * You can't destruct `process.env` as a regular object, so you have to do
 * it manually here. This is because Next.js evaluates this at build time,
 * and only used environment variables are included in the build.
 * @type {{ [k in keyof z.infer<typeof clientSchema>]: z.infer<typeof clientSchema>[k] | undefined }}
 */
export const clientEnv = {
	NEXT_PUBLIC_STRIPE_REDIRECT_URL: process.env.NEXT_PUBLIC_STRIPE_REDIRECT_URL,
	NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
	NEXT_PUBLIC_PRICE_ID_STARTUP: process.env.NEXT_PUBLIC_PRICE_ID_STARTUP,
	NEXT_PUBLIC_PRICE_ID_CUSTOM: process.env.NEXT_PUBLIC_PRICE_ID_CUSTOM,
	NEXT_PUBLIC_PRICE_ID_MAYOR: process.env.NEXT_PUBLIC_PRICE_ID_MAYOR,
	NEXT_PUBLIC_PRICE_ID_PREMIER: process.env.NEXT_PUBLIC_PRICE_ID_PREMIER,
	NEXT_PUBLIC_PRICE_ID_GOVERNOR: process.env.NEXT_PUBLIC_PRICE_ID_GOVERNOR,
	NEXT_PUBLIC_PRICE_ID_PRIME_MINISTER: process.env.NEXT_PUBLIC_PRICE_ID_PRIME_MINISTER,
};
