import { PrismaClient } from "@prisma/client";

import { env } from "../env/server.mjs";
import { prisma } from "./db";

export type PushSubscriptionPayload = {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
};

type EventPushSubscription = {
    eventId: string;
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
};

const subscriptions = new Map<string, EventPushSubscription[]>();
const notifiedEventIds = new Set<string>();
let reminderScheduler: NodeJS.Timeout | undefined;

const getWebPush = async () => {
    const webPush = await import("web-push");

    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
        webPush.default.setVapidDetails(
            `mailto:${env.VAPID_EMAIL ?? "hello@hackthehill.com"}`,
            env.VAPID_PUBLIC_KEY,
            env.VAPID_PRIVATE_KEY,
        );
    }

    return webPush.default;
};

export const resetEventNotificationState = () => {
    notifiedEventIds.clear();
};

export const getDueEventNotificationIds = (
    events: Array<{ id: string; start: Date | string }>,
    now: Date = new Date(),
    alreadyNotified: Set<string> = notifiedEventIds,
) => {
    return events
        .filter(event => {
            const start = event.start instanceof Date ? event.start : new Date(event.start);
            return start <= now && !alreadyNotified.has(event.id);
        })
        .map(event => event.id);
};

export const startEventReminderScheduler = () => {
    if (typeof window !== "undefined" || reminderScheduler) {
        return reminderScheduler;
    }

    reminderScheduler = setInterval(() => {
        void sendDueEventNotifications().catch(() => undefined);
    }, 60_000);

    void sendDueEventNotifications().catch(() => undefined);
    return reminderScheduler;
};

export const registerEventPushSubscription = (eventId: string, subscription: PushSubscriptionPayload) => {
    const current = subscriptions.get(eventId) ?? [];
    const cleaned = current.filter(item => item.endpoint !== subscription.endpoint);
    cleaned.push({
        eventId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
    });
    subscriptions.set(eventId, cleaned);
};

export const unregisterEventPushSubscription = (eventId: string, endpoint?: string) => {
    if (!endpoint) {
        subscriptions.delete(eventId);
        return;
    }

    const current = subscriptions.get(eventId) ?? [];
    const next = current.filter(item => item.endpoint !== endpoint);
    if (next.length === 0) {
        subscriptions.delete(eventId);
        return;
    }

    subscriptions.set(eventId, next);
};

export const getEventPushSubscriptions = (eventId: string) => subscriptions.get(eventId) ?? [];

export const sendEventStartNotification = async (eventId: string, title: string, body: string) => {
    const eventSubscriptions = getEventPushSubscriptions(eventId);
    if (eventSubscriptions.length === 0) {
        return 0;
    }

    const webPush = await getWebPush();
    const deliveries = await Promise.allSettled(
        eventSubscriptions.map(subscription =>
            webPush.sendNotification(
                {
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.keys.p256dh,
                        auth: subscription.keys.auth,
                    },
                } as any,
                JSON.stringify({
                    title,
                    body,
                    tag: `event-${eventId}`,
                    icon: "/icons/android-chrome-192x192.png",
                }),
            ),
        ),
    );

    let delivered = 0;
    for (const result of deliveries) {
        if (result.status === "fulfilled") {
            delivered += 1;
        }
    }

    return delivered;
};

export const sendDueEventNotifications = async (prismaClient: PrismaClient = prisma) => {
    const now = new Date();
    const dueEvents = await prismaClient.event.findMany({
        where: {
            start: {
                lte: now,
            },
        },
        select: {
            id: true,
            name: true,
            start: true,
        },
    });

    const dueEventIds = getDueEventNotificationIds(dueEvents, now);
    for (const eventId of dueEventIds) {
        const event = dueEvents.find(candidate => candidate.id === eventId);
        if (!event) {
            continue;
        }

        const title = event.name;
        const body = "This event has started.";
        await sendEventStartNotification(event.id, title, body);
        notifiedEventIds.add(event.id);
    }

    return dueEventIds.length;
};

if (typeof process !== "undefined" && process.versions?.node && process.env.NODE_ENV !== "test") {
    void startEventReminderScheduler();
}
