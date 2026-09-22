import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import {
	getPushConfiguration,
	hasValidPushKeys,
	PushRegistrationClosedError,
	PushSubscriptionLimitError,
	isAllowedPushEndpoint,
	registerEventPushSubscription,
	unregisterEventPushSubscription,
} from "@/server/push";

const requestSchema = z.discriminatedUnion("enabled", [
	z
		.object({
			eventId: z.string().min(1).max(191),
			enabled: z.literal(false),
			subscription: z.object({ endpoint: z.string().min(1).max(512).refine(isAllowedPushEndpoint) }).strict(),
		})
		.strict(),
	z
		.object({
			eventId: z.string().min(1).max(191),
			enabled: z.literal(true),
			locale: z.enum(["en", "fr"]),
			publicKey: z.string().min(1),
			subscription: z
				.object({
					endpoint: z.string().min(1).max(512).refine(isAllowedPushEndpoint),
					keys: z
						.object({ p256dh: z.string().max(87), auth: z.string().max(22) })
						.strict()
						.refine(hasValidPushKeys),
				})
				.strict(),
		})
		.strict(),
]);

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
	response.setHeader("Cache-Control", "no-store");
	if (request.method === "GET") {
		const configuration = getPushConfiguration();
		response.status(200).json({ available: !!configuration, publicKey: configuration?.publicKey ?? null });
		return;
	}
	if (request.method !== "POST") {
		response.setHeader("Allow", "GET, POST");
		response.status(405).json({ error: "Method not allowed" });
		return;
	}
	const parsed = requestSchema.safeParse(request.body);
	if (!parsed.success) {
		response.status(400).json({ error: "Invalid push subscription" });
		return;
	}
	const { eventId, subscription } = parsed.data;
	if (!parsed.data.enabled) {
		try {
			await unregisterEventPushSubscription(eventId, subscription.endpoint);
			response.status(200).json({ success: true });
		} catch {
			response.status(503).json({ error: "Unable to update notifications. Please try again." });
		}
		return;
	}
	const configuration = getPushConfiguration();
	if (!configuration || parsed.data.publicKey !== configuration.publicKey) {
		response.status(503).json({ error: "Push notifications unavailable" });
		return;
	}
	try {
		await registerEventPushSubscription(eventId, parsed.data.subscription, parsed.data.locale);
		response.status(200).json({ success: true });
	} catch (error) {
		if (error instanceof PushRegistrationClosedError || error instanceof PushSubscriptionLimitError) {
			response.status(409).json({ error: error.message });
		} else {
			response.status(503).json({ error: "Unable to update notifications. Please try again." });
		}
	}
}
