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

const ALLOWED_PUSH_DOMAINS = [
    /(^|\.)push\.apple\.com$/i,
    /(^|\.)push\.services\.mozilla\.com$/i,
    /(^|\.)fcm\.googleapis\.com$/i,
    /(^|\.)android\.googleapis\.com$/i,
    /(^|\.)notify\.windows\.com$/i,
    /(^|\.)wns\.windows\.com$/i,
];

export const isAllowedPushEndpoint = (endpoint: string): boolean => {
    if (!endpoint || typeof endpoint !== "string") {
        return false;
    }

    try {
        const parsed = new URL(endpoint);
        if (parsed.protocol !== "https:") {
            return false;
        }

        if (parsed.username || parsed.password) {
            return false;
        }

        if (parsed.port && parsed.port !== "443") {
            return false;
        }

        const hostname = parsed.hostname.toLowerCase();
        if (!hostname || hostname.includes("..")) {
            return false;
        }

        return ALLOWED_PUSH_DOMAINS.some(pattern => pattern.test(hostname));
    } catch {
        return false;
    }
};

const notifiedEventIds = new Set<string>();
let reminderScheduler: NodeJS.Timeout | undefined;

const getServerEnv = async () => {
    try {
        const { env } = await import("../env/server.mjs");
        return env;
    } catch {
        return {
            VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
            VAPID_EMAIL: process.env.VAPID_EMAIL,
        };
    }
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
    if (!eventId || !subscription || !isAllowedPushEndpoint(subscription.endpoint)) {
        throw new Error("Invalid push subscription endpoint");
    }

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

export const unregisterEventPushSubscription = async (
    eventId: string,
    endpoint: string,
    prismaClient?: PrismaClient,
) => {
    if (!endpoint) {
        return;
    }

    const client = prismaClient ?? (await getPrismaClient());
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

const getErrorStatusCode = (error: unknown): number | undefined => {
    if (typeof error === "object" && error !== null) {
        if ("statusCode" in error && typeof (error as { statusCode: unknown }).statusCode === "number") {
            return (error as { statusCode: number }).statusCode;
        }
        if ("status" in error && typeof (error as { status: unknown }).status === "number") {
            return (error as { status: number }).status;
        }
    }
    return undefined;
};

export const sendEventStartNotification = async (
    eventId: string,
    title: string,
    body: string,
    prismaClient?: PrismaClient,
) => {
    const eventSubscriptions = await getEventPushSubscriptions(eventId, prismaClient);
    if (eventSubscriptions.length === 0) {
        return { delivered: 0, failed: 0, total: 0 };
    }

    const client = prismaClient ?? (await getPrismaClient());
    const webPush = await getWebPush();

    let delivered = 0;
    let failed = 0;

    await Promise.all(
        eventSubscriptions.map(async subscription => {
            if (!isAllowedPushEndpoint(subscription.endpoint)) {
                await client.pushSubscription.deleteMany({
                    where: { eventId, endpoint: subscription.endpoint },
                });
                return;
            }

            try {
                await webPush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.keys.p256dh,
                            auth: subscription.keys.auth,
                        },
                    },
                    JSON.stringify({
                        title,
                        body,
                        tag: `event-${eventId}`,
                        icon: "/icons/android-chrome-192x192.png",
                    }),
                );

                delivered += 1;
                await client.pushSubscription.deleteMany({
                    where: { eventId, endpoint: subscription.endpoint },
                });
            } catch (error: unknown) {
                const statusCode = getErrorStatusCode(error);
                if (statusCode === 404 || statusCode === 410) {
                    await client.pushSubscription.deleteMany({
                        where: { eventId, endpoint: subscription.endpoint },
                    });
                } else {
                    failed += 1;
                }
            }
        }),
    );

    return { delivered, failed, total: eventSubscriptions.length };
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

    let fullyNotifiedCount = 0;
    for (const event of dueEvents) {
        const title = event.name;
        const body = "This event has started.";
        const result = await sendEventStartNotification(event.id, title, body, client);
        if (result.failed === 0) {
            await client.event.update({ where: { id: event.id }, data: { notifiedAt: now } });
            notifiedEventIds.add(event.id);
            fullyNotifiedCount += 1;
        }
    }

    return fullyNotifiedCount;
};

if (typeof process !== "undefined" && process.versions?.node && process.env.NODE_ENV !== "test") {
    void startEventReminderScheduler();
}
