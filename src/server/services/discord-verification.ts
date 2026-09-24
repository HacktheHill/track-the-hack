import { z } from "zod";
import { readDiscordProof, signDiscordRequest } from "@/server/lib/discord-proof";

export const discordVerificationBodySchema = z.object({ token: z.string().min(1).max(256) }).strict();
const botSuccessSchema = z.object({ ok: z.literal(true) }).strict();
const botConflictSchema = z
	.object({
		ok: z.literal(false),
		reason: z.enum(["discord-account-linked", "participant-linked", "both-linked"]),
	})
	.strict();
export type DiscordVerificationStatus =
	| "verified"
	| "invalid"
	| "conflict"
	| "discord-account-conflict"
	| "participant-conflict"
	| "unavailable";

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
		// Accept only a fixed conflict reason. Never pass through identifiers or arbitrary bot errors.
		if (response.status === 409) {
			const conflict = botConflictSchema.safeParse(await response.json().catch(() => null));
			if (!conflict.success || conflict.data.reason === "both-linked") return "conflict";
			return conflict.data.reason === "discord-account-linked"
				? "discord-account-conflict"
				: "participant-conflict";
		}
		if (response.status === 410) return "invalid";
		if (!response.ok) return "unavailable";
		return botSuccessSchema.safeParse(await response.json()).success ? "verified" : "unavailable";
	} catch {
		return "unavailable";
	}
};
