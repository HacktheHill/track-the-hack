import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory, ScannerWorkflow, TShirtSize } from "@prisma/client";
import {
	adjustPresenceForEvent,
	scanParticipantForEvent,
	type ScannerRepository,
} from "@/server/services/scanner-workflows";

const eventId = "event-1";
const hackerId = "wvY1HKlwYnFBO8t-YnQbwg";

const scannerDatabase = (
	workflow: ScannerWorkflow,
	maxCheckIns: number | null = 3,
	tShirtSize: TShirtSize = TShirtSize.L,
	scannerEnabled = true,
) => {
	const event = {
		id: eventId,
		name: "Operational event",
		nameFr: "Événement opérationnel",
		scannerEnabled,
		scannerWorkflow: workflow,
		maxCheckIns,
	};
	const hacker = {
		id: hackerId,
		confirmed: true,
		tShirtSize,
		mealCategory: MealCategory.OTHER,
	};
	const presences = new Map<
		string,
		{ id: string; hackerId: string; eventId: string; label: string; value: number }
	>();
	const key = `${hackerId}:${eventId}`;

	const repository: ScannerRepository = {
		findEvent: id => Promise.resolve(id === eventId ? event : null),
		findEventMaximum: id =>
			Promise.resolve(id === eventId ? { maxCheckIns, scannerEnabled, scannerWorkflow: workflow } : null),
		findCheckInParticipant: id =>
			Promise.resolve(
				id === hackerId ? { id: hacker.id, confirmed: hacker.confirmed, tShirtSize: hacker.tShirtSize } : null,
			),
		findMerchandiseParticipant: id =>
			Promise.resolve(id === hackerId ? { id: hacker.id, tShirtSize: hacker.tShirtSize } : null),
		findFoodParticipant: id =>
			Promise.resolve(id === hackerId ? { id: hacker.id, mealCategory: hacker.mealCategory } : null),
		findAttendanceParticipant: id => Promise.resolve(id === hackerId ? { id: hacker.id } : null),
		ensurePresence: ({ id, eventId: scannedEventId, hackerId: scannedHackerId, label, initialValue }) => {
			if (!presences.has(key)) {
				presences.set(key, {
					id,
					hackerId: scannedHackerId,
					eventId: scannedEventId,
					label,
					value: initialValue,
				});
			}
			return Promise.resolve();
		},
		incrementPresence: ({ eventId: adjustedEventId, hackerId: adjustedHackerId, maximum }) => {
			const presence = presences.get(`${adjustedHackerId}:${adjustedEventId}`);
			if (!presence || presence.value >= maximum) return Promise.resolve(false);
			presence.value += 1;
			return Promise.resolve(true);
		},
		adjustPresence: ({ eventId: adjustedEventId, hackerId: adjustedHackerId, amount, expectedValue, maximum }) => {
			const presence = presences.get(`${adjustedHackerId}:${adjustedEventId}`);
			if (
				!presence ||
				presence.value !== expectedValue ||
				(amount < 0 && presence.value <= 0) ||
				(amount > 0 && maximum !== null && presence.value >= maximum)
			) {
				return Promise.resolve(false);
			}
			presence.value += amount;
			return Promise.resolve(true);
		},
		findPresence: (searchedEventId, searchedHackerId) => {
			const presence = presences.get(`${searchedHackerId}:${searchedEventId}`);
			return Promise.resolve(presence ? { id: presence.id, value: presence.value } : null);
		},
	};

	return { repository, value: () => presences.get(key)?.value };
};

void test("each scanner workflow returns only its allowed participant fields", async () => {
	const cases = [
		[ScannerWorkflow.CHECK_IN, ["confirmed", "id", "tShirtSize"]],
		[ScannerWorkflow.MERCHANDISE, ["id", "tShirtSize"]],
		[ScannerWorkflow.FOOD, ["id", "mealCategory", "requiresFoodLead"]],
		[ScannerWorkflow.ATTENDANCE, ["id"]],
	] as const;

	for (const [workflow, fields] of cases) {
		const { repository } = scannerDatabase(workflow);
		const result = await scanParticipantForEvent(repository, eventId, hackerId);
		assert.deepEqual(Object.keys(result.participant).sort(), [...fields].sort());
	}
});

void test("T-shirt opt-outs are returned by check-in and merchandise scans and do not exclude other merchandise", async () => {
	for (const workflow of [ScannerWorkflow.CHECK_IN, ScannerWorkflow.MERCHANDISE]) {
		const { repository } = scannerDatabase(workflow, 1, TShirtSize.NONE);
		const result = await scanParticipantForEvent(repository, eventId, hackerId);
		if (result.workflow !== ScannerWorkflow.CHECK_IN && result.workflow !== ScannerWorkflow.MERCHANDISE) {
			assert.fail("Expected a workflow that includes the T-shirt preference");
		}
		assert.equal(result.participant.tShirtSize, TShirtSize.NONE);
		assert.equal(result.value, 1);
		assert.equal(result.atLimit, true);
	}
});

void test("food OTHER tells the scanner to contact the food lead", async () => {
	const { repository } = scannerDatabase(ScannerWorkflow.FOOD);
	const result = await scanParticipantForEvent(repository, eventId, hackerId);
	assert.equal(result.workflow, ScannerWorkflow.FOOD);
	if (result.workflow !== ScannerWorkflow.FOOD) assert.fail("Expected the food workflow");
	assert.equal(result.participant.mealCategory, MealCategory.OTHER);
	assert.equal(result.participant.requiresFoodLead, true);
});

void test("repeated scans increment every capped multi-check-in workflow up to its limit", async () => {
	for (const workflow of Object.values(ScannerWorkflow)) {
		const { repository, value } = scannerDatabase(workflow, 3);
		const first = await scanParticipantForEvent(repository, eventId, hackerId);
		assert.equal(first.value, 1);
		assert.equal(first.outcome, "new");
		assert.equal((await scanParticipantForEvent(repository, eventId, hackerId)).outcome, "incremented");
		assert.equal((await scanParticipantForEvent(repository, eventId, hackerId)).outcome, "incremented");
		const limited = await scanParticipantForEvent(repository, eventId, hackerId);
		assert.equal(limited.outcome, "limit");
		assert.equal(limited.value, 3);
		assert.equal(value(), 3);
	}
});

void test("uncapped and single-check-in stations remain idempotent on repeat scans", async () => {
	for (const maximum of [null, 1] as const) {
		const { repository, value } = scannerDatabase(ScannerWorkflow.ATTENDANCE, maximum);
		assert.equal((await scanParticipantForEvent(repository, eventId, hackerId)).outcome, "new");
		const repeated = await scanParticipantForEvent(repository, eventId, hackerId);
		assert.equal(repeated.outcome, maximum === 1 ? "limit" : "unchanged");
		assert.equal(value(), 1);
	}
});

void test("manual adjustments retain expected-value reconciliation", async () => {
	const { repository, value } = scannerDatabase(ScannerWorkflow.ATTENDANCE, 3);
	const first = await scanParticipantForEvent(repository, eventId, hackerId);
	assert.equal(first.value, 1);
	assert.equal(first.recordedNow, true);
	assert.equal((await adjustPresenceForEvent(repository, eventId, hackerId, 1, 1)).value, 2);
	assert.equal(value(), 2);
});

void test("scanner-disabled events reject scans and manual adjustments", async () => {
	const { repository } = scannerDatabase(ScannerWorkflow.ATTENDANCE, 3, TShirtSize.L, false);
	await assert.rejects(scanParticipantForEvent(repository, eventId, hackerId), /EVENT_NOT_FOUND/);
	await assert.rejects(adjustPresenceForEvent(repository, eventId, hackerId, 1, 0), /EVENT_NOT_FOUND/);
});

void test("concurrent first scans share one event-linked counter", async () => {
	const { repository, value } = scannerDatabase(ScannerWorkflow.CHECK_IN, 2);
	const results = await Promise.all(
		Array.from({ length: 8 }, () => scanParticipantForEvent(repository, eventId, hackerId)),
	);
	assert.ok(results.every(result => result.value === 1));
	assert.equal(results.filter(result => result.recordedNow).length, 1);
	assert.equal(value(), 1);
});

void test("concurrent scanner increments cannot cross the server-owned maximum", async () => {
	const { repository, value } = scannerDatabase(ScannerWorkflow.CHECK_IN, 2);
	await scanParticipantForEvent(repository, eventId, hackerId);
	const results = await Promise.all(
		Array.from({ length: 8 }, () => adjustPresenceForEvent(repository, eventId, hackerId, 1, 1)),
	);
	assert.equal(value(), 2);
	assert.equal(results.filter(result => result.applied).length, 1);
	assert.equal(results.filter(result => result.stale).length, 7);
	const atLimit = await adjustPresenceForEvent(repository, eventId, hackerId, 1, 2);
	assert.equal(atLimit.atLimit, true);
	assert.equal(atLimit.applied, false);
	assert.equal(atLimit.stale, false);
});

void test("an uncapped counter can be incremented again after reaching zero", async () => {
	const { repository } = scannerDatabase(ScannerWorkflow.ATTENDANCE, null);
	await scanParticipantForEvent(repository, eventId, hackerId);
	assert.equal((await adjustPresenceForEvent(repository, eventId, hackerId, -1, 1)).value, 0);
	assert.equal((await adjustPresenceForEvent(repository, eventId, hackerId, 1, 0)).value, 1);
});

void test("a stale decrement returns the authoritative value and can be retried deliberately", async () => {
	const { repository } = scannerDatabase(ScannerWorkflow.ATTENDANCE, null);
	await scanParticipantForEvent(repository, eventId, hackerId);
	const first = await adjustPresenceForEvent(repository, eventId, hackerId, 1, 1);
	const stale = await adjustPresenceForEvent(repository, eventId, hackerId, -1, 1);
	assert.equal(first.value, 2);
	assert.equal(stale.value, 2);
	assert.equal(stale.applied, false);
	assert.equal(stale.stale, true);
	const retry = await adjustPresenceForEvent(repository, eventId, hackerId, -1, stale.value);
	assert.equal(retry.value, 1);
	assert.equal(retry.applied, true);
	assert.equal(retry.stale, false);
});
