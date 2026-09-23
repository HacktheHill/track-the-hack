import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MealCategory, PrismaClient, ScannerWorkflow, TShirtSize } from "@prisma/client";
import {
	adjustPresenceForEvent,
	createPrismaScannerRepository,
	scanParticipantForEvent,
} from "@/server/services/scanner-workflows";

const testDatabase = process.env.PUSH_TEST_DATABASE_URL;

void test(
	"real MySQL serializes simultaneous scans and stale count adjustments",
	{ skip: !testDatabase },
	async t => {
		if (!testDatabase) return;
		const prisma = new PrismaClient({ datasourceUrl: testDatabase });
		const suffix = randomUUID();
		const hackerId = `scanner-hacker-${suffix}`;
		const eventId = `scanner-event-${suffix}`;
		t.after(async () => {
			await prisma.presence.deleteMany({ where: { hackerId, eventId } });
			await prisma.event.deleteMany({ where: { id: eventId } });
			await prisma.hacker.deleteMany({ where: { id: hackerId } });
			await prisma.$disconnect();
		});

		await prisma.hacker.create({
			data: {
				id: hackerId,
				tShirtSize: TShirtSize.NONE,
				mealCategory: MealCategory.STANDARD,
				acceptanceExpiry: new Date("2030-01-01T00:00:00Z"),
			},
		});
		await prisma.event.create({
			data: {
				id: eventId,
				start: new Date("2030-01-01T12:00:00Z"),
				end: new Date("2030-01-01T13:00:00Z"),
				name: "Concurrency test",
				nameFr: "Test de concurrence",
				description: "Test event",
				descriptionFr: "Événement de test",
				room: "Test room",
				scannerWorkflow: ScannerWorkflow.CHECK_IN,
				maxCheckIns: 3,
			},
		});

		const repository = createPrismaScannerRepository(prisma);
		const scans = await Promise.all(
			Array.from({ length: 8 }, () => scanParticipantForEvent(repository, eventId, hackerId)),
		);
		assert.equal(scans.filter(scan => scan.recordedNow).length, 1);
		assert.ok(scans.every(scan => scan.value === 1));
		assert.equal(await prisma.presence.count({ where: { hackerId, eventId } }), 1);

		const adjustments = await Promise.all(
			Array.from({ length: 8 }, () => adjustPresenceForEvent(repository, eventId, hackerId, 1, 1)),
		);
		assert.equal(adjustments.filter(result => result.applied).length, 1);
		assert.equal(adjustments.filter(result => result.stale).length, 7);
		assert.equal((await prisma.presence.findUniqueOrThrow({ where: { hackerId_eventId: { hackerId, eventId } } })).value, 2);

		const retry = await adjustPresenceForEvent(repository, eventId, hackerId, 1, 2);
		assert.equal(retry.value, 3);
		assert.equal(retry.applied, true);
		assert.equal(retry.stale, false);
	},
);
