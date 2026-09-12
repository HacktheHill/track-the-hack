import type { NextApiRequest, NextApiResponse } from "next";

import { registerEventPushSubscription, unregisterEventPushSubscription } from "../../../server/push";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    if (!eventId) {
        response.status(400).json({ error: "Missing eventId" });
        return;
    }

    const subscription = body.subscription as Record<string, unknown> | undefined;
    if (!subscription || typeof subscription !== "object") {
        response.status(400).json({ error: "Missing push subscription" });
        return;
    }

    const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint : "";

    if (body.enabled === false) {
        if (!endpoint) {
            response.status(400).json({ error: "Invalid push subscription" });
            return;
        }

        await unregisterEventPushSubscription(eventId, endpoint);
        response.status(200).json({ success: true });
        return;
    }

    const keys = (subscription.keys ?? {}) as Record<string, unknown>;
    const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
    const auth = typeof keys.auth === "string" ? keys.auth : "";

    if (!endpoint || !p256dh || !auth) {
        response.status(400).json({ error: "Invalid push subscription" });
        return;
    }

    await registerEventPushSubscription(eventId, {
        endpoint,
        keys: {
            p256dh,
            auth,
        },
    });

    response.status(200).json({ success: true });
}
