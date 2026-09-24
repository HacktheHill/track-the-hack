import assert from "node:assert/strict";
import test from "node:test";
import { findMigrationNameErrors } from "@/server/lib/prisma-migration-names.mjs";

void test("accepts the clean baseline and the exact grandfathered migration timestamp pairs", () => {
	assert.deepEqual(
		findMigrationNameErrors([
			"0_init",
			"20260922000000_add_event_import_identity",
			"20260922000000_secure_sms_reminders",
			"20260923000000_remove_sms_reminders",
			"20260923000000_restore_event_tiktok_compatibility",
			"20260923010000_add_event_room_fr",
			"20260923010000_rsvp_management",
		]),
		[],
	);
});

void test("rejects a new migration that reuses a legacy timestamp prefix", () => {
	const errors = findMigrationNameErrors([
		"20260922000000_add_event_import_identity",
		"20260922000000_secure_sms_reminders",
		"20260923010000_add_event_room_fr",
		"20260923010000_rsvp_management",
		"20260923010000_new_feature",
	]);
	assert.equal(errors.length, 1);
	assert.match(errors[0] ?? "", /Duplicate Prisma migration timestamp prefix 20260923010000/);
});

void test("rejects duplicate newly generated prefixes and malformed migration names", () => {
	const errors = findMigrationNameErrors([
		"20260925000000_add_feature",
		"20260925000000_add_other_feature",
		"2026_add_missing_timestamp",
	]);
	assert.equal(errors.length, 2);
	assert.match(errors[0] ?? "", /Invalid Prisma migration directory name/);
	assert.match(errors[1] ?? "", /Duplicate Prisma migration timestamp prefix 20260925000000/);
});
