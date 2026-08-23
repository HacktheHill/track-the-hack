import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory, ScannerWorkflow, TShirtSize } from "@prisma/client";
import { adjustPresenceForEvent, scanParticipantForEvent } from "@/server/services/scanner-workflows";

type ScannerClient = Parameters<typeof scanParticipantForEvent>[0];

const eventId = "event-1";
const hackerId = "wvY1HKlwYnFBO8t-YnQbwg";

const project = (source: Record<string, unknown>, select: Record<string, boolean>) =>
	Object.fromEntries(Object.keys(select).flatMap(key => (select[key] ? [[key, source[key]]] : [])));

const scannerDatabase = (workflow: ScannerWorkflow, maxCheckIns: number | null = 3) => {
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
		tShirtSize: TShirtSize.L,
		mealCategory: MealCategory.OTHER,
		walkIn: true,
		acceptanceExpiry: new Date("2026-09-01T00:00:00Z"),
	};
	const presences = new Map<
		string,
		{ id: string; hackerId: string; eventId: string; label: string; value: number }
	>();
	const key = `${hackerId}:${eventId}`;

	const prisma = {
		$executeRaw: () => {
			if (!presences.has(key)) {
				presences.set(key, {
					id: "presence-1",
					hackerId,
					eventId,
					label: event.name,
					value: maxCheckIns === null || maxCheckIns > 0 ? 1 : 0,
				});
			}
			return Promise.resolve(1);
		},
		event: {
			findUnique: ({ where, select }: { where: { id: string }; select: Record<string, boolean> }) =>
				Promise.resolve(where.id === eventId ? project(event, select) : null),
		},
		hacker: {
			findUnique: ({ where, select }: { where: { id: string }; select: Record<string, boolean> }) =>
				Promise.resolve(where.id === hackerId ? project(hacker, select) : null),
		},
		presence: {
			updateMany: ({
				where,
				data,
			}: {
				where: { hackerId: string; eventId: string; value?: { lt?: number; gt?: number } };
				data: { value: { increment: number } };
			}) => {
				const presence = presences.get(`${where.hackerId}:${where.eventId}`);
				if (!presence) return Promise.resolve({ count: 0 });
				if (where.value?.lt !== undefined && presence.value >= where.value.lt)
					return Promise.resolve({ count: 0 });
				if (where.value?.gt !== undefined && presence.value <= where.value.gt)
					return Promise.resolve({ count: 0 });
				presence.value += data.value.increment;
				return Promise.resolve({ count: 1 });
			},
			findUnique: () => {
				const presence = presences.get(key);
				return Promise.resolve(presence ? { id: presence.id, value: presence.value } : null);
			},
		},
	} as unknown as ScannerClient;

	return { prisma, value: () => presences.get(key)?.value };
};

void test("each scanner workflow returns only its allowed participant fields", async () => {
	const cases = [
		[ScannerWorkflow.CHECK_IN, ["confirmed", "id", "tShirtSize"]],
		[ScannerWorkflow.MERCHANDISE, ["id", "tShirtSize"]],
		[ScannerWorkflow.FOOD, ["id", "mealCategory", "requiresFoodLead"]],
		[ScannerWorkflow.ATTENDANCE, ["id"]],
	] as const;

	for (const [workflow, fields] of cases) {
		const { prisma } = scannerDatabase(workflow);
		const result = await scanParticipantForEvent(prisma, eventId, hackerId);
		assert.deepEqual(Object.keys(result.participant).sort(), [...fields].sort());
	}
});

void test("food OTHER tells the scanner to contact the food lead", async () => {
	const { prisma } = scannerDatabase(ScannerWorkflow.FOOD);
	const result = await scanParticipantForEvent(prisma, eventId, hackerId);
	assert.equal(result.workflow, ScannerWorkflow.FOOD);
	if (result.workflow !== ScannerWorkflow.FOOD) assert.fail("Expected the food workflow");
	assert.equal(result.participant.mealCategory, MealCategory.OTHER);
	assert.equal(result.participant.requiresFoodLead, true);
});

void test("repeated scans preserve the event-linked counter", async () => {
	const { prisma, value } = scannerDatabase(ScannerWorkflow.ATTENDANCE, 3);
	assert.equal((await scanParticipantForEvent(prisma, eventId, hackerId)).value, 1);
	assert.equal((await adjustPresenceForEvent(prisma, eventId, hackerId, 1)).value, 2);
	assert.equal((await scanParticipantForEvent(prisma, eventId, hackerId)).value, 2);
	assert.equal(value(), 2);
});

void test("concurrent first scans share one event-linked counter", async () => {
	const { prisma, value } = scannerDatabase(ScannerWorkflow.CHECK_IN, 2);
	const results = await Promise.all(
		Array.from({ length: 8 }, () => scanParticipantForEvent(prisma, eventId, hackerId)),
	);
	assert.ok(results.every(result => result.value === 1));
	assert.equal(value(), 1);
});

void test("concurrent scanner increments cannot cross the server-owned maximum", async () => {
	const { prisma, value } = scannerDatabase(ScannerWorkflow.CHECK_IN, 2);
	await scanParticipantForEvent(prisma, eventId, hackerId);
	await Promise.all(Array.from({ length: 8 }, () => adjustPresenceForEvent(prisma, eventId, hackerId, 1)));
	assert.equal(value(), 2);
	assert.equal((await adjustPresenceForEvent(prisma, eventId, hackerId, 1)).atLimit, true);
});

void test("an uncapped counter can be incremented again after reaching zero", async () => {
	const { prisma } = scannerDatabase(ScannerWorkflow.ATTENDANCE, null);
	await scanParticipantForEvent(prisma, eventId, hackerId);
	assert.equal((await adjustPresenceForEvent(prisma, eventId, hackerId, -1)).value, 0);
	assert.equal((await adjustPresenceForEvent(prisma, eventId, hackerId, 1)).value, 1);
});
