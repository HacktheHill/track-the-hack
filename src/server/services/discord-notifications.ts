import { z } from "zod";
import { signNotificationRequest } from "@/server/lib/discord-proof";

type DiscordNotificationConfig = { botUrl?: string; secret?: string };

const statusResponseSchema = z
	.object({
		ok: z.literal(true),
		links: z.array(z.object({ hackerId: z.string(), linked: z.boolean() }).strict()),
	})
	.strict();

const deliveryOutcomeSchema = z.enum(["sent", "not_linked", "dm_unavailable", "temporary_failure", "uncertain"]);
const deliveryResponseSchema = z
	.object({
		ok: z.literal(true),
		deliveries: z.array(z.object({ id: z.string().uuid(), outcome: deliveryOutcomeSchema }).strict()),
	})
	.strict();

const signedRequest = async (
	path: string,
	domain: "participant-links-status" | "notifications-deliver",
	body: string,
	config: DiscordNotificationConfig,
	send: typeof fetch,
) => {
	if (!config.botUrl || !config.secret) return null;
	const timestamp = String(Math.floor(Date.now() / 1000));
	return send(new URL(path, config.botUrl), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-track-the-hack-timestamp": timestamp,
			"x-track-the-hack-signature": signNotificationRequest(domain, body, timestamp, config.secret),
		},
		body,
		signal: AbortSignal.timeout(20_000),
		redirect: "error",
	});
};

export const getDiscordLinkStatuses = async (
	hackerIds: string[],
	config: DiscordNotificationConfig,
	send: typeof fetch = fetch,
) => {
	if (!hackerIds.length) return new Map<string, boolean>();
	try {
		const response = await signedRequest(
			"/participant-links/status",
			"participant-links-status",
			JSON.stringify({ hackerIds }),
			config,
			send,
		);
		if (!response?.ok) return null;
		const parsed = statusResponseSchema.safeParse(await response.json());
		return parsed.success ? new Map(parsed.data.links.map(link => [link.hackerId, link.linked])) : null;
	} catch {
		return null;
	}
};

export const deliverDiscordNotifications = async (
	deliveries: Array<{ id: string; hackerId: string; content: string }>,
	config: DiscordNotificationConfig,
	send: typeof fetch = fetch,
) => {
	try {
		const response = await signedRequest(
			"/notifications/deliver",
			"notifications-deliver",
			JSON.stringify({ deliveries }),
			config,
			send,
		);
		if (!response?.ok) return null;
		const parsed = deliveryResponseSchema.safeParse(await response.json());
		return parsed.success ? parsed.data.deliveries : null;
	} catch {
		return null;
	}
};
