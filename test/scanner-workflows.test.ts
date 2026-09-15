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
) => {
	const event = {
		id: eventId,
		name: "Operational event",
		nameFr: "Événement opérationnel",
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
		findEventMaximum: id => Promise.resolve(id === eventId ? { maxCheckIns } : null),
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
		adjustPresence: ({ eventId: adjustedEventId, hackerId: adjustedHackerId, amount, maximum }) => {
			const presence = presences.get(`${adjustedHackerId}:${adjustedEventId}`);
			if (
				!presence ||
				(amount < 0 && presence.value <= 0) ||
				(amount > 0 && maximum !== null && presence.value >= maximum)
			) {
				return Promise.resolve();
			}
			presence.value += amount;
			return Promise.resolve();
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

void test("repeated scans preserve the event-linked counter", async () => {
	const { repository, value } = scannerDatabase(ScannerWorkflow.ATTENDANCE, 3);
	assert.equal((await scanParticipantForEvent(repository, eventId, hackerId)).value, 1);
	assert.equal((await adjustPresenceForEvent(repository, eventId, hackerId, 1)).value, 2);
	assert.equal((await scanParticipantForEvent(repository, eventId, hackerId)).value, 2);
	assert.equal(value(), 2);
});

void test("concurrent first scans share one event-linked counter", async () => {
	const { repository, value } = scannerDatabase(ScannerWorkflow.CHECK_IN, 2);
	const results = await Promise.all(
		Array.from({ length: 8 }, () => scanParticipantForEvent(repository, eventId, hackerId)),
	);
	assert.ok(results.every(result => result.value === 1));
	assert.equal(value(), 1);
});

void test("concurrent scanner increments cannot cross the server-owned maximum", async () => {
	const { repository, value } = scannerDatabase(ScannerWorkflow.CHECK_IN, 2);
	await scanParticipantForEvent(repository, eventId, hackerId);
	await Promise.all(Array.from({ length: 8 }, () => adjustPresenceForEvent(repository, eventId, hackerId, 1)));
	assert.equal(value(), 2);
	assert.equal((await adjustPresenceForEvent(repository, eventId, hackerId, 1)).atLimit, true);
});

void test("an uncapped counter can be incremented again after reaching zero", async () => {
	const { repository } = scannerDatabase(ScannerWorkflow.ATTENDANCE, null);
	await scanParticipantForEvent(repository, eventId, hackerId);
	assert.equal((await adjustPresenceForEvent(repository, eventId, hackerId, -1)).value, 0);
	assert.equal((await adjustPresenceForEvent(repository, eventId, hackerId, 1)).value, 1);
});
