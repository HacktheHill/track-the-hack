import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory, ScannerWorkflow, TShirtSize, type PrismaClient } from "@prisma/client";
import {
	createPrismaOperationalMetricsRepository,
	getOperationalMetrics,
	type OperationalMetricsRepository,
} from "@/server/services/operational-metrics";

void test("checked-in count uses distinct participant IDs across check-in events", async t => {
	const count = t.mock.fn(() => Promise.resolve(2));
	// Partial database mock exposes only the operation exercised by this repository method.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const prisma = {
		hacker: { count },
	} as unknown as Pick<PrismaClient, "event" | "hacker" | "presence">;

	const repository = createPrismaOperationalMetricsRepository(prisma);
	assert.equal(await repository.countCheckedIn(), 2);
	assert.deepEqual(count.mock.calls[0]?.arguments, [
		{
			where: { presences: { some: { event: { scannerWorkflow: ScannerWorkflow.CHECK_IN }, value: { gt: 0 } } } },
		},
	]);
});

void test("operational metrics expose only aggregate database-derived values", async () => {
	const hackerGroupings: string[][] = [];
	let summedPresences = false;
	const repository: OperationalMetricsRepository = {
		countProvisioned: () => Promise.resolve(10),
		countConfirmed: () => Promise.resolve(8),
		countWalkIns: () => Promise.resolve(2),
		countCheckedIn: () => Promise.resolve(7),
		sumPresences: () => {
			summedPresences = true;
			return Promise.resolve(5);
		},
		groupAttendanceByEvent: () =>
			Promise.resolve([
				{ eventId: "event-1", _sum: { value: 3 } },
				{ eventId: "event-2", _sum: { value: 2 } },
			]),
		groupMealCategories: () => {
			hackerGroupings.push(["mealCategory"]);
			return Promise.resolve([{ mealCategory: MealCategory.HALAL, _count: { mealCategory: 4 } }]);
		},
		groupTShirtSizes: () => {
			hackerGroupings.push(["tShirtSize"]);
			return Promise.resolve([{ tShirtSize: TShirtSize.M, _count: { tShirtSize: 3 } }]);
		},
		findEventNames: ids => {
			assert.deepEqual(ids, ["event-1", "event-2"]);
			return Promise.resolve([
				{ id: "event-1", name: "Lunch" },
				{ id: "event-2", name: "Lunch" },
			]);
		},
	};

	const metrics = await getOperationalMetrics(repository);

	assert.deepEqual(metrics, {
		provisioned: 10,
		confirmed: 8,
		walkIn: 2,
		checkedIn: 7,
		presences: 5,
		attendanceData: [
			{ eventId: "event-1", label: "Lunch", _sum: { value: 3 } },
			{ eventId: "event-2", label: "Lunch", _sum: { value: 2 } },
		],
		mealCategoryData: [{ mealCategory: MealCategory.HALAL, _count: { mealCategory: 4 } }],
		tShirtSizeData: [{ tShirtSize: TShirtSize.M, _count: { tShirtSize: 3 } }],
	});
	assert.deepEqual(hackerGroupings, [["mealCategory"], ["tShirtSize"]]);
	assert.equal(summedPresences, true);
});
