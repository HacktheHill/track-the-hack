import { z } from "zod";
import { readDiscordProof, signDiscordRequest } from "@/server/lib/discord-proof";

export const discordVerificationBodySchema = z.object({ token: z.string().min(1).max(256) }).strict();
const botSuccessSchema = z.object({ ok: z.literal(true) }).strict();
export type DiscordVerificationStatus = "verified" | "invalid" | "conflict" | "unavailable";

export const completeDiscordVerification = async (
	token: string,
	hackerId: string,
	config: { botUrl: string; secret: string },
	send: typeof fetch = fetch,
	now = Date.now(),
): Promise<DiscordVerificationStatus> => {
	if (!readDiscordProof(token, config.secret, now)) return "invalid";
	const body = JSON.stringify({ token, hackerId });
	const timestamp = String(Math.floor(now / 1000));
	try {
		const response = await send(new URL("/verify", config.botUrl), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-track-the-hack-timestamp": timestamp,
				"x-track-the-hack-signature": signDiscordRequest(body, timestamp, config.secret),
			},
			body,
			signal: AbortSignal.timeout(10_000),
			redirect: "error",
		});
		// Never pass through bot response bodies/errors: they may contain external identity.
		if (response.status === 409) return "conflict";
		if (response.status === 410) return "invalid";
		if (!response.ok) return "unavailable";
		return botSuccessSchema.safeParse(await response.json()).success ? "verified" : "unavailable";
	} catch {
		return "unavailable";
	}
};
