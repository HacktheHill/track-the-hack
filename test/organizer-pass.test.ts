import assert from "node:assert/strict";
import test from "node:test";
import { ScannerWorkflow, type PrismaClient } from "@prisma/client";
import { createOrganizerPass, parseOrganizerPass } from "@/server/lib/organizer-pass";
import { scanOrganizerForEvent } from "@/server/services/organizer-scanner";

/* eslint-disable @typescript-eslint/consistent-type-assertions -- focused Prisma mocks expose only exercised methods */

void test("organizer pass values are typed and contain only the organizer identifier", () => {
	assert.equal(createOrganizerPass("organizer-1"), "organizer:organizer-1");
	assert.equal(parseOrganizerPass("organizer:organizer-1"), "organizer-1");
	assert.equal(parseOrganizerPass("wvY1HKlwYnFBO8t-YnQbwg"), null);
	assert.equal(parseOrganizerPass("organizer:"), null);
});

void test("organizer scans write separate presence without participant profile fields", async () => {
	let presence: { id: string; value: number } | null = null;
	const prisma = {
		user: {
			findUnique: () => ({
				id: "organizer-1",
				name: "Daniel",
				email: "daniel.thorp@ctn-rtc.org",
				isAdmin: true,
				disabledAt: null,
			}),
		},
		organizerAccess: { findUnique: () => null },
		event: {
			findUnique: () => ({
				id: "lunch",
				name: "Lunch",
				nameFr: "Dîner",
				scannerEnabled: true,
				scannerWorkflow: ScannerWorkflow.FOOD,
				maxCheckIns: 1,
			}),
		},
		organizerPresence: {
			findUnique: () => presence,
		},
		$executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => {
			if (query.join("").includes("INSERT INTO"))
				presence ??= { id: String(values[0]), value: Number(values[1]) };
			return 1;
		},
	} as unknown as PrismaClient;

	const first = await scanOrganizerForEvent(prisma, "lunch", "organizer-1");
	assert.deepEqual(first.organizer, { id: "organizer-1", name: "Daniel" });
	assert.equal(first.subjectType, "organizer");
	assert.equal(first.outcome, "new");
	assert.equal("mealCategory" in first.organizer, false);
	assert.equal("tShirtSize" in first.organizer, false);

	const repeated = await scanOrganizerForEvent(prisma, "lunch", "organizer-1");
	assert.equal(repeated.outcome, "limit");
	assert.equal(repeated.value, 1);
});

void test("disabled, removed, or shared-mailbox organizers cannot be scanned", async () => {
	const base = {
		event: {
			findUnique: () => ({
				id: "lunch",
				name: "Lunch",
				nameFr: "Dîner",
				scannerEnabled: true,
				scannerWorkflow: ScannerWorkflow.FOOD,
				maxCheckIns: 1,
			}),
		},
		organizerPresence: { findUnique: () => null },
		$executeRaw: () => 0,
	};
	const disabled = {
		...base,
		user: {
			findUnique: () => ({
				id: "organizer-1",
				name: "Organizer",
				email: "test.organizer@ctn-rtc.org",
				isAdmin: false,
				disabledAt: new Date(),
			}),
		},
		organizerAccess: { findUnique: () => null },
	} as unknown as PrismaClient;
	await assert.rejects(scanOrganizerForEvent(disabled, "lunch", "organizer-1"), /PARTICIPANT_NOT_FOUND/);

	const removed = {
		...base,
		user: {
			findUnique: () => ({
				id: "organizer-2",
				name: "Organizer",
				email: "organizer@example.com",
				isAdmin: false,
				disabledAt: null,
			}),
		},
		organizerAccess: { findUnique: () => null },
	} as unknown as PrismaClient;
	await assert.rejects(scanOrganizerForEvent(removed, "lunch", "organizer-2"), /PARTICIPANT_NOT_FOUND/);

	const sharedMailbox = {
		...base,
		user: {
			findUnique: () => ({
				id: "organizer-3",
				name: "Logistics",
				email: "logistics@ctn-rtc.org",
				isAdmin: false,
				disabledAt: null,
			}),
		},
		// A stale or manually inserted allowlist row must not bypass the CTN rule.
		organizerAccess: { findUnique: () => ({ id: "stale-access" }) },
	} as unknown as PrismaClient;
	await assert.rejects(scanOrganizerForEvent(sharedMailbox, "lunch", "organizer-3"), /PARTICIPANT_NOT_FOUND/);
});
