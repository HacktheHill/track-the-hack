import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory, ScannerWorkflow, TShirtSize } from "@prisma/client";
import { getOperationalMetrics } from "@/server/services/operational-metrics";

type MetricsDatabase = Parameters<typeof getOperationalMetrics>[0];

void test("operational metrics expose only aggregate database-derived values", async () => {
	const hackerGroupings: string[][] = [];
	let presenceAggregate: { value: boolean } | undefined;
	const prisma = {
		hacker: {
			count: ({ where }: { where?: { confirmed?: boolean; walkIn?: boolean } } = {}) =>
				Promise.resolve(where?.confirmed ? 8 : where?.walkIn ? 2 : 10),
			groupBy: ({ by }: { by: string[] }) => {
				hackerGroupings.push(by);
				return Promise.resolve(
					by[0] === "mealCategory"
						? [{ mealCategory: MealCategory.HALAL, _count: { mealCategory: 4 } }]
						: [{ tShirtSize: TShirtSize.M, _count: { tShirtSize: 3 } }],
				);
			},
		},
		presence: {
			count: ({ where }: { where: { event: { scannerWorkflow: ScannerWorkflow }; value: { gt: number } } }) => {
				assert.equal(where.event.scannerWorkflow, ScannerWorkflow.CHECK_IN);
				assert.deepEqual(where.value, { gt: 0 });
				return Promise.resolve(7);
			},
			aggregate: ({ _sum }: { _sum: { value: boolean } }) => {
				presenceAggregate = _sum;
				return Promise.resolve({ _sum: { value: 5 } });
			},
			groupBy: ({ by }: { by: string[] }) => {
				assert.deepEqual(by, ["label"]);
				return Promise.resolve([{ label: "Opening", _sum: { value: 5 } }]);
			},
		},
	} as unknown as MetricsDatabase;

	const metrics = await getOperationalMetrics(prisma);

	assert.deepEqual(metrics, {
		provisioned: 10,
		confirmed: 8,
		walkIn: 2,
		checkedIn: 7,
		presences: 5,
		attendanceData: [{ label: "Opening", _sum: { value: 5 } }],
		mealCategoryData: [{ mealCategory: MealCategory.HALAL, _count: { mealCategory: 4 } }],
		tShirtSizeData: [{ tShirtSize: TShirtSize.M, _count: { tShirtSize: 3 } }],
	});
	assert.deepEqual(hackerGroupings, [["mealCategory"], ["tShirtSize"]]);
	assert.deepEqual(presenceAggregate, { value: true });
});
