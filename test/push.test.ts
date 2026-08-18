import assert from "node:assert/strict";
import test from "node:test";

import { getDueEventNotificationIds, resetEventNotificationState } from "../src/server/push.ts";

test("only returns events that are due and have not already been notified", () => {
    resetEventNotificationState();
    const now = new Date("2026-08-18T18:00:00Z");
    const due = getDueEventNotificationIds([
        { id: "already-sent", start: new Date("2026-08-18T17:59:00Z") },
        { id: "due-now", start: new Date("2026-08-18T17:59:30Z") },
        { id: "future", start: new Date("2026-08-18T18:00:30Z") },
    ], now, new Set(["already-sent"]));

    assert.deepEqual(due, ["due-now"]);
});
