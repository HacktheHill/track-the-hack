import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import type { SendResult } from "web-push";
import webPush from "web-push";

import {
    getDueEventNotificationIds,
    isAllowedPushEndpoint,
    registerEventPushSubscription,
    resetEventNotificationState,
    sendDueEventNotifications,
    unregisterEventPushSubscription,
} from "../src/server/push.ts";

void test("only returns events that are due and have not already been notified", () => {
    resetEventNotificationState();
    const now = new Date("2026-08-18T18:00:00Z");
    const due = getDueEventNotificationIds([
        { id: "already-sent", start: new Date("2026-08-18T17:59:00Z") },
        { id: "due-now", start: new Date("2026-08-18T17:59:30Z") },
        { id: "future", start: new Date("2026-08-18T18:00:30Z") },
    ], now, new Set(["already-sent"]));

    assert.deepEqual(due, ["due-now"]);
});

void test("isAllowedPushEndpoint validates supported push domains and rejects private/internal endpoints", () => {
    // Valid supported endpoints
    assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/sample-token"), true);
    assert.equal(isAllowedPushEndpoint("https://android.googleapis.com/gcm/send/sample-token"), true);
    assert.equal(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/sample-token"), true);
    assert.equal(isAllowedPushEndpoint("https://web.push.apple.com/sample-token"), true);
    assert.equal(isAllowedPushEndpoint("https://db5p.notify.windows.com/w/?token=sample-token"), true);
    assert.equal(isAllowedPushEndpoint("https://client.wns.windows.com/sample-token"), true);

    // Insecure protocol
    assert.equal(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/sample-token"), false);

    // Private / internal IP addresses and hostnames
    assert.equal(isAllowedPushEndpoint("https://localhost/push"), false);
    assert.equal(isAllowedPushEndpoint("https://localhost:8080/push"), false);
    assert.equal(isAllowedPushEndpoint("https://127.0.0.1/push"), false);
    assert.equal(isAllowedPushEndpoint("https://10.0.0.1/push"), false);
    assert.equal(isAllowedPushEndpoint("https://192.168.1.1/push"), false);
    assert.equal(isAllowedPushEndpoint("https://169.254.169.254/latest/meta-data"), false);
    assert.equal(isAllowedPushEndpoint("https://[::1]/push"), false);
    assert.equal(isAllowedPushEndpoint("https://metadata.google.internal/push"), false);
    assert.equal(isAllowedPushEndpoint("https://internal.service.local/push"), false);

    // Domain spoofing / attacker domains
    assert.equal(isAllowedPushEndpoint("https://evil-push.apple.com/push"), false);
    assert.equal(isAllowedPushEndpoint("https://push.apple.com.attacker.com/push"), false);
    assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com.attacker.com/push"), false);
    assert.equal(isAllowedPushEndpoint("https://user:pass@fcm.googleapis.com/"), false);
    assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/send"), false);

    // Empty or malformed input
    assert.equal(isAllowedPushEndpoint(""), false);
    assert.equal(isAllowedPushEndpoint("not-a-url"), false);
});

void test("registerEventPushSubscription rejects invalid push endpoint", async () => {
    const mockPrisma = {
        pushSubscription: {
            deleteMany: () => Promise.resolve({ count: 0 }),
            create: () => Promise.resolve({}),
        },
    } as unknown as PrismaClient;

    await assert.rejects(
        () =>
            registerEventPushSubscription(
                "event-1",
                {
                    endpoint: "https://localhost:8080/push",
                    keys: { p256dh: "key-p256dh", auth: "key-auth" },
                },
                mockPrisma,
            ),
        { message: "Invalid push subscription endpoint" },
    );
});

void test("registerEventPushSubscription stores valid push subscription", async () => {
    const createdCalls: Array<{ data: { eventId: string; endpoint: string; p256dh: string; auth: string } }> = [];
    const mockPrisma = {
        pushSubscription: {
            deleteMany: () => Promise.resolve({ count: 0 }),
            create: (args: { data: { eventId: string; endpoint: string; p256dh: string; auth: string } }) => {
                createdCalls.push(args);
                return Promise.resolve(args.data);
            },
        },
    } as unknown as PrismaClient;

    await registerEventPushSubscription(
        "event-1",
        {
            endpoint: "https://fcm.googleapis.com/fcm/send/token-123",
            keys: { p256dh: "key-p256dh", auth: "key-auth" },
        },
        mockPrisma,
    );

    assert.equal(createdCalls.length, 1);
    assert.deepEqual(createdCalls[0]?.data, {
        eventId: "event-1",
        endpoint: "https://fcm.googleapis.com/fcm/send/token-123",
        p256dh: "key-p256dh",
        auth: "key-auth",
    });
});

void test("unregisterEventPushSubscription deletes only matching eventId and endpoint", async () => {
    const deletedCalls: Array<{ where: { eventId: string; endpoint?: string } }> = [];
    const mockPrisma = {
        pushSubscription: {
            deleteMany: (args: { where: { eventId: string; endpoint?: string } }) => {
                deletedCalls.push(args);
                return Promise.resolve({ count: 1 });
            },
        },
    } as unknown as PrismaClient;

    await unregisterEventPushSubscription("event-1", "https://push.example.com/sub-1", mockPrisma);

    assert.equal(deletedCalls.length, 1);
    assert.deepEqual(deletedCalls[0], {
        where: { eventId: "event-1", endpoint: "https://push.example.com/sub-1" },
    });
});

void test("unregisterEventPushSubscription ignores empty endpoint and does not perform bulk delete", async () => {
    const deletedCalls: Array<{ where: { eventId: string; endpoint?: string } }> = [];
    const mockPrisma = {
        pushSubscription: {
            deleteMany: (args: { where: { eventId: string; endpoint?: string } }) => {
                deletedCalls.push(args);
                return Promise.resolve({ count: 0 });
            },
        },
    } as unknown as PrismaClient;

    await unregisterEventPushSubscription("event-1", "", mockPrisma);

    assert.equal(deletedCalls.length, 0);
});

void test("sendDueEventNotifications retries temporary failures without duplicating delivered subscribers", async () => {
    resetEventNotificationState();
    const originalSend = webPush.sendNotification;

    let subscriptions = [
        {
            id: "sub-1",
            eventId: "event-1",
            endpoint: "https://fcm.googleapis.com/fcm/send/alice",
            p256dh: "p256dh-1",
            auth: "auth-1",
        },
        {
            id: "sub-2",
            eventId: "event-1",
            endpoint: "https://updates.push.services.mozilla.com/wpush/v2/bob",
            p256dh: "p256dh-2",
            auth: "auth-2",
        },
    ];

    const events = [
        {
            id: "event-1",
            name: "Opening Ceremony",
            start: new Date("2026-08-18T10:00:00Z"),
            notifiedAt: null as Date | null,
        },
    ];

    const updatedEvents: Array<{ id: string; notifiedAt: Date }> = [];
    const sentEndpoints: string[] = [];
    let simulateBobFail = true;

    const mockPrisma = {
        event: {
            findMany: () => {
                return Promise.resolve(events.filter(e => e.notifiedAt === null));
            },
            update: (args: { where: { id: string }; data: { notifiedAt: Date } }) => {
                const target = events.find(e => e.id === args.where.id);
                if (target) {
                    target.notifiedAt = args.data.notifiedAt;
                }
                updatedEvents.push({ id: args.where.id, notifiedAt: args.data.notifiedAt });
                return Promise.resolve(target);
            },
        },
        pushSubscription: {
            findMany: (args: { where: { eventId: string } }) => {
                return Promise.resolve(subscriptions.filter(s => s.eventId === args.where.eventId));
            },
            deleteMany: (args: { where: { eventId: string; endpoint?: string } }) => {
                subscriptions = subscriptions.filter(
                    s => !(s.eventId === args.where.eventId && s.endpoint === args.where.endpoint),
                );
                return Promise.resolve({ count: 1 });
            },
        },
    } as unknown as PrismaClient;

    try {
        const customSend = ((subscription: { endpoint: string }): Promise<SendResult> => {
            sentEndpoints.push(subscription.endpoint);
            if (subscription.endpoint.includes("bob") && simulateBobFail) {
                const error = Object.assign(new Error("503 Service Unavailable"), { statusCode: 503 });
                return Promise.reject(error);
            }
            return Promise.resolve({ statusCode: 201, headers: {}, body: "" });
        }) as unknown as typeof webPush.sendNotification;

        webPush.sendNotification = customSend;

        // First run: Alice succeeds, Bob fails with temporary 503 error
        const firstRunNotified = await sendDueEventNotifications(mockPrisma);
        assert.equal(firstRunNotified, 0, "Event should not be marked notified when a delivery failed");
        assert.equal(events[0]?.notifiedAt, null, "Event notifiedAt should remain null for retries");
        assert.equal(sentEndpoints.length, 2, "Both subscribers should be contacted on first attempt");
        assert.deepEqual(
            subscriptions.map(s => s.endpoint),
            ["https://updates.push.services.mozilla.com/wpush/v2/bob"],
            "Delivered subscription (Alice) should be removed so retries do not send duplicate",
        );

        // Second run: Bob service recovers and succeeds
        simulateBobFail = false;
        const secondRunNotified = await sendDueEventNotifications(mockPrisma);
        assert.equal(secondRunNotified, 1, "Event should be marked fully notified after retry succeeds");
        assert.notEqual(events[0]?.notifiedAt, null, "Event notifiedAt should now be set");
        assert.equal(sentEndpoints.length, 3, "Only Bob should be sent to on second attempt (total 3 sends: Alice, Bob, Bob)");
        assert.equal(sentEndpoints[2], "https://updates.push.services.mozilla.com/wpush/v2/bob");
        assert.equal(subscriptions.length, 0, "All subscriptions should now be completed");
    } finally {
        webPush.sendNotification = originalSend;
    }
});

void test("sendDueEventNotifications cleans up expired 410 subscriptions and marks event notified", async () => {
    resetEventNotificationState();
    const originalSend = webPush.sendNotification;

    let subscriptions = [
        {
            id: "sub-expired",
            eventId: "event-2",
            endpoint: "https://fcm.googleapis.com/fcm/send/expired-token",
            p256dh: "p256dh",
            auth: "auth",
        },
    ];

    const events = [
        {
            id: "event-2",
            name: "Workshop",
            start: new Date("2026-08-18T10:00:00Z"),
            notifiedAt: null as Date | null,
        },
    ];

    const mockPrisma = {
        event: {
            findMany: () => Promise.resolve(events.filter(e => e.notifiedAt === null)),
            update: (args: { where: { id: string }; data: { notifiedAt: Date } }) => {
                const target = events.find(e => e.id === args.where.id);
                if (target) {
                    target.notifiedAt = args.data.notifiedAt;
                }
                return Promise.resolve(target);
            },
        },
        pushSubscription: {
            findMany: (args: { where: { eventId: string } }) => {
                return Promise.resolve(subscriptions.filter(s => s.eventId === args.where.eventId));
            },
            deleteMany: (args: { where: { eventId: string; endpoint?: string } }) => {
                subscriptions = subscriptions.filter(
                    s => !(s.eventId === args.where.eventId && s.endpoint === args.where.endpoint),
                );
                return Promise.resolve({ count: 1 });
            },
        },
    } as unknown as PrismaClient;

    try {
        const customSend = (() => {
            const error = Object.assign(new Error("410 Gone"), { statusCode: 410 });
            return Promise.reject(error);
        }) as unknown as typeof webPush.sendNotification;

        webPush.sendNotification = customSend;

        const notifiedCount = await sendDueEventNotifications(mockPrisma);
        assert.equal(notifiedCount, 1, "Event should be marked notified after expired subscription is removed");
        assert.notEqual(events[0]?.notifiedAt, null);
        assert.equal(subscriptions.length, 0, "Expired subscription should be pruned from database");
    } finally {
        webPush.sendNotification = originalSend;
    }
});

void test("api/push/register rejects SSRF endpoints and invalid payloads", async () => {
    const handler = (await import("../src/pages/api/push/register")).default;

    type MockResponse = {
        statusCode: number;
        jsonData: unknown;
        status: (code: number) => MockResponse;
        json: (data: unknown) => MockResponse;
    };

    const createMockRes = (): MockResponse => {
        const res: MockResponse = {
            statusCode: 200,
            jsonData: null,
            status(code: number) {
                res.statusCode = code;
                return res;
            },
            json(data: unknown) {
                res.jsonData = data;
                return res;
            },
        };
        return res;
    };

    // Test non-POST method
    const getReq = { method: "GET" } as unknown as NextApiRequest;
    const getRes = createMockRes();
    await handler(getReq, getRes as unknown as NextApiResponse);
    assert.equal(getRes.statusCode, 405);

    // Test missing eventId
    const noEventReq = {
        method: "POST",
        body: { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/1" } },
    } as unknown as NextApiRequest;
    const noEventRes = createMockRes();
    await handler(noEventReq, noEventRes as unknown as NextApiResponse);
    assert.equal(noEventRes.statusCode, 400);

    // Test SSRF attempt (internal IP)
    const ssrfReq = {
        method: "POST",
        body: {
            eventId: "event-1",
            subscription: {
                endpoint: "https://169.254.169.254/latest/meta-data",
                keys: { p256dh: "p256dh", auth: "auth" },
            },
        },
    } as unknown as NextApiRequest;
    const ssrfRes = createMockRes();
    await handler(ssrfReq, ssrfRes as unknown as NextApiResponse);
    assert.equal(ssrfRes.statusCode, 400);
    assert.deepEqual(ssrfRes.jsonData, { error: "Invalid push subscription" });
});
