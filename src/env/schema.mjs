// @ts-check
import { z } from "zod";

/**
 * Resolve the public base URL used in participant-facing links.
 * An explicit deployment URL always takes precedence over Vercel's hostname.
 *
 * @param {unknown} configuredUrl
 * @param {string | undefined} vercelUrl
 */
export const resolveNextAuthUrl = (configuredUrl, vercelUrl) => {
	if (typeof configuredUrl === "string" && configuredUrl.length > 0) return configuredUrl;
	return vercelUrl ? `https://${vercelUrl}` : configuredUrl;
};

/**
 * Specify your server-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 */
export const serverSchema = z.object({
	DATABASE_URL: z.string().url(),
	NODE_ENV: z.enum(["development", "test", "production"]),
	NEXTAUTH_SECRET: process.env.NODE_ENV === "production" ? z.string().min(1) : z.string().min(1).optional(),
	NEXTAUTH_URL: z.preprocess(value => resolveNextAuthUrl(value, process.env.VERCEL_URL), z.string().url()),
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
	DEV_AUTH_ENABLED: z.enum(["0", "1"]).default("0"),
	SHEETS_INTEGRATION_API_KEY: z.string().min(32),
	CANCELLATION_TOKEN_SECRET: z.string().min(32),
	CLAIM_TOKEN_SECRET: z.string().min(32),
	PARTICIPANT_SESSION_SECRET: z.string().min(32),
	DISCORD_BOT_URL: z.preprocess(value => value || undefined, z.string().url().optional()),
	INTERNAL_API_SECRET: z.preprocess(value => value || undefined, z.string().min(32).optional()),
	VAPID_PUBLIC_KEY: z.string().optional(),
	VAPID_PRIVATE_KEY: z.string().optional(),
	VAPID_EMAIL: z.preprocess(value => value || undefined, z.string().email().optional()),
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
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	DEV_AUTH_ENABLED:
		process.env.DEV_AUTH_ENABLED === "1" ? "1" : process.env.DEV_AUTH_ENABLED === "0" ? "0" : undefined,
	SHEETS_INTEGRATION_API_KEY: process.env.SHEETS_INTEGRATION_API_KEY,
	CANCELLATION_TOKEN_SECRET: process.env.CANCELLATION_TOKEN_SECRET,
	CLAIM_TOKEN_SECRET: process.env.CLAIM_TOKEN_SECRET,
	PARTICIPANT_SESSION_SECRET: process.env.PARTICIPANT_SESSION_SECRET,
	DISCORD_BOT_URL: process.env.DISCORD_BOT_URL,
	INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
	VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
	VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
	VAPID_EMAIL: process.env.VAPID_EMAIL,
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
	NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
});

/**
 * You can't destruct `process.env` as a regular object, so you have to do
 * it manually here. This is because Next.js evaluates this at build time,
 * and only used environment variables are included in the build.
 * @type {{ [k in keyof z.infer<typeof clientSchema>]: z.infer<typeof clientSchema>[k] | undefined }}
 */
export const clientEnv = {
	NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
};
