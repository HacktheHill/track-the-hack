import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";

import {
    getDueEventNotificationIds,
    resetEventNotificationState,
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
