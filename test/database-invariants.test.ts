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
