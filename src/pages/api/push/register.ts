import type { NextApiRequest, NextApiResponse } from "next";

import { registerEventPushSubscription, unregisterEventPushSubscription } from "../../../server/push";

export default function handler(request: NextApiRequest, response: NextApiResponse) {
    if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
    }

    const { eventId, enabled, subscription } = request.body ?? {};
    if (!eventId || typeof eventId !== "string") {
        response.status(400).json({ error: "Missing eventId" });
        return;
    }

    if (!subscription || typeof subscription !== "object") {
        response.status(400).json({ error: "Missing push subscription" });
        return;
    }

    if (enabled === false) {
        unregisterEventPushSubscription(eventId, typeof subscription.endpoint === "string" ? subscription.endpoint : undefined);
        response.status(200).json({ success: true });
        return;
    }

    const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint : "";
    const keys = subscription.keys ?? {};
    if (!endpoint || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
        response.status(400).json({ error: "Invalid push subscription" });
        return;
    }

    registerEventPushSubscription(eventId, {
        endpoint,
        keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
        },
    });

    response.status(200).json({ success: true });
}
