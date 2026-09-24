import assert from "node:assert/strict";
import test from "node:test";
import { auditRetentionCutoff, purgeExpiredAuditEvents } from "@/server/services/audit-retention";

void test("audit retention uses an exact 90-day UTC cutoff", () => {
	assert.equal(auditRetentionCutoff(new Date("2026-09-24T12:00:00.000Z")).toISOString(), "2026-06-26T12:00:00.000Z");
});

void test("audit purge repeats bounded batches and stops after a partial batch", async () => {
	const batches = [1_000, 1_000, 12];
	let calls = 0;
	const result = await purgeExpiredAuditEvents(
		// Partial database mock exposes only the raw delete operation exercised here.
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		{
			$executeRaw: () => Promise.resolve(batches[calls++] ?? 0),
		} as never,
		new Date("2026-09-24T12:00:00.000Z"),
	);
	assert.equal(calls, 3);
	assert.equal(result.deleted, 2_012);
});
