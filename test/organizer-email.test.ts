import assert from "node:assert/strict";
import test from "node:test";
import { failedOrganizerEmailRecipients } from "@/server/lib/organizer-email";

void test("organizer email accepts SMTP results without a pending recipient list", () => {
	assert.deepEqual(failedOrganizerEmailRecipients({ rejected: [] }), []);
});

void test("organizer email still detects rejected or pending recipients", () => {
	assert.deepEqual(
		failedOrganizerEmailRecipients({ rejected: ["rejected@example.com"], pending: ["pending@example.com"] }),
		["rejected@example.com", "pending@example.com"],
	);
});
