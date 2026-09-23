import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MealCategory, PrismaClient, TShirtSize } from "@prisma/client";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";
import type { ProvisioningRecord } from "@/server/services/hacker-lifecycle";

// This suite requires a migrated, disposable local MySQL database.
const testDatabase = process.env.PUSH_TEST_DATABASE_URL;

void test("MySQL preserves case-distinct event interests and atomic provisioning", { skip: !testDatabase }, async t => {
	assert.ok(testDatabase);
	const url = new URL(testDatabase);
	assert.ok(
		["localhost", "127.0.0.1"].includes(url.hostname) && /test|review/.test(url.pathname),
		"Use an isolated local test database",
	);

	const prisma = new PrismaClient({ datasourceUrl: testDatabase });
	const suffix = randomUUID().replaceAll("-", "");
	const upperId = `Case${suffix}`;
	const lowerId = upperId.toLowerCase();
	const eventId = `event-${suffix}`;
	t.after(async () => {
		await prisma.eventInterest.deleteMany({ where: { eventId } });
		await prisma.event.deleteMany({ where: { id: eventId } });
		await prisma.hacker.deleteMany({ where: { id: { in: [upperId, lowerId, `batch-${suffix}`] } } });
		await prisma.$disconnect();
	});

	const hackerData = (id: string) => ({
		id,
		tShirtSize: TShirtSize.M,
		mealCategory: MealCategory.HALAL,
		acceptanceExpiry: new Date("2027-01-01T00:00:00.000Z"),
	});
	await prisma.hacker.createMany({ data: [hackerData(upperId), hackerData(lowerId)] });
	await prisma.event.create({
		data: {
			id: eventId,
			name: "Invariant test",
			nameFr: "Invariant test",
			start: new Date("2027-01-01T00:00:00.000Z"),
			end: new Date("2027-01-01T01:00:00.000Z"),
			description: "",
			descriptionFr: "",
			room: "",
		},
	});
	await prisma.eventInterest.createMany({
		data: [
			{ id: randomUUID(), hackerId: upperId, eventId },
			{ id: randomUUID(), hackerId: lowerId, eventId },
		],
	});
	assert.equal(await prisma.eventInterest.count({ where: { eventId } }), 2);

	const repository = new PrismaHackerLifecycleRepository(prisma);
	const validRecord: ProvisioningRecord = hackerData(`batch-${suffix}`);
	const invalidRecord: ProvisioningRecord = hackerData("x".repeat(192));
	await assert.rejects(repository.upsertProvisionedBatch([validRecord, invalidRecord]));
	assert.equal(await prisma.hacker.count({ where: { id: validRecord.id } }), 0);
});

void test("MySQL provisioning preserves confirmed and declined RSVP responses", { skip: !testDatabase }, async t => {
	assert.ok(testDatabase);
	const url = new URL(testDatabase);
	assert.ok(
		["localhost", "127.0.0.1"].includes(url.hostname) && /test|review/.test(url.pathname),
		"Use an isolated local test database",
	);

	const prisma = new PrismaClient({ datasourceUrl: testDatabase });
	const suffix = randomUUID().replaceAll("-", "");
	const confirmedId = `confirmed-${suffix}`;
	const declinedId = `declined-${suffix}`;
	const confirmedAt = new Date("2026-09-20T12:00:00.000Z");
	const declinedAt = new Date("2026-09-21T12:00:00.000Z");
	t.after(async () => {
		await prisma.hacker.deleteMany({ where: { id: { in: [confirmedId, declinedId] } } });
		await prisma.$disconnect();
	});

	const original = {
		tShirtSize: TShirtSize.S,
		mealCategory: MealCategory.VEGAN,
		acceptanceExpiry: new Date("2026-09-27T14:00:00.000Z"),
	};
	await prisma.hacker.createMany({
		data: [
			{ id: confirmedId, ...original, confirmed: true, rsvpRespondedAt: confirmedAt },
			{ id: declinedId, ...original, confirmed: false, rsvpRespondedAt: declinedAt },
		],
	});

	const updated = {
		tShirtSize: TShirtSize.XL,
		mealCategory: MealCategory.HALAL,
		acceptanceExpiry: new Date("2026-09-28T14:00:00.000Z"),
	};
	const repository = new PrismaHackerLifecycleRepository(prisma);
	await repository.upsertProvisionedBatch([
		{ id: confirmedId, ...updated },
		{ id: declinedId, ...updated },
	]);

	const hackers = await prisma.hacker.findMany({
		where: { id: { in: [confirmedId, declinedId] } },
		orderBy: { id: "asc" },
		select: {
			id: true,
			confirmed: true,
			rsvpRespondedAt: true,
			tShirtSize: true,
			mealCategory: true,
			acceptanceExpiry: true,
		},
	});
	assert.deepEqual(hackers, [
		{ id: confirmedId, confirmed: true, rsvpRespondedAt: confirmedAt, ...updated },
		{ id: declinedId, confirmed: false, rsvpRespondedAt: declinedAt, ...updated },
	].sort((left, right) => left.id.localeCompare(right.id)));
});
