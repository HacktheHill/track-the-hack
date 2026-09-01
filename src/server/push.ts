import type { PrismaClient } from "@prisma/client";

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

const notifiedEventIds = new Set<string>();
let reminderScheduler: NodeJS.Timeout | undefined;

const getServerEnv = async () => {
    const { env } = await import("../env/server.mjs");
    return env;
};

const getPrismaClient = async () => {
    const { prisma } = await import("./db");
    return prisma;
};

const getWebPush = async () => {
    const webPush = await import("web-push");
    const env = await getServerEnv();

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
    reminderScheduler.unref?.();

    void sendDueEventNotifications().catch(() => undefined);
    return reminderScheduler;
};

export const registerEventPushSubscription = async (
    eventId: string,
    subscription: PushSubscriptionPayload,
    prismaClient?: PrismaClient,
) => {
    const client = prismaClient ?? (await getPrismaClient());
    await client.pushSubscription.deleteMany({ where: { eventId, endpoint: subscription.endpoint } });
    await client.pushSubscription.create({
        data: {
            eventId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
        },
    });
};

export const unregisterEventPushSubscription = async (eventId: string, endpoint?: string, prismaClient?: PrismaClient) => {
    const client = prismaClient ?? (await getPrismaClient());
    if (!endpoint) {
        await client.pushSubscription.deleteMany({ where: { eventId } });
        return;
    }

    await client.pushSubscription.deleteMany({ where: { eventId, endpoint } });
};

export const getEventPushSubscriptions = async (
    eventId: string,
    prismaClient?: PrismaClient,
): Promise<EventPushSubscription[]> => {
    const client = prismaClient ?? (await getPrismaClient());
    const subscriptions = await client.pushSubscription.findMany({ where: { eventId } });
    return subscriptions.map(subscription => ({
        eventId: subscription.eventId,
        endpoint: subscription.endpoint,
        keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
        },
    }));
};

export const sendEventStartNotification = async (
    eventId: string,
    title: string,
    body: string,
    prismaClient?: PrismaClient,
) => {
    const eventSubscriptions = await getEventPushSubscriptions(eventId, prismaClient);
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

export const sendDueEventNotifications = async (prismaClient?: PrismaClient) => {
    const client = prismaClient ?? (await getPrismaClient());
    const now = new Date();
    const dueEvents = await client.event.findMany({
        where: {
            start: {
                lte: now,
            },
            notifiedAt: null,
        },
        select: {
            id: true,
            name: true,
            start: true,
        },
    });

    for (const event of dueEvents) {
        const title = event.name;
        const body = "This event has started.";
        await sendEventStartNotification(event.id, title, body, client);
        await client.event.update({ where: { id: event.id }, data: { notifiedAt: now } });
    }

    return dueEvents.length;
};

if (typeof process !== "undefined" && process.versions?.node && process.env.NODE_ENV !== "test") {
    void startEventReminderScheduler();
}
