import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory } from "@prisma/client";
import { generateNotificationCohorts } from "@/server/services/notification-cohorts";

const candidate = (id: string, mealCategory: MealCategory = MealCategory.STANDARD) => ({ id, mealCategory });

void test("food cohorts are deterministic, balanced, bounded, and dietary-priority first", () => {
	const candidates = [
		candidate("standard-1"),
		candidate("vegan", MealCategory.VEGAN),
		candidate("standard-2"),
		candidate("halal", MealCategory.HALAL),
		candidate("standard-3"),
		candidate("vegetarian", MealCategory.VEGETARIAN),
		candidate("standard-4"),
	];
	const first = generateNotificationCohorts(candidates, 3, "stable-seed");
	const second = generateNotificationCohorts(candidates, 3, "stable-seed");
	assert.deepEqual(first, second);
	assert.deepEqual(
		first.map(cohort => cohort.length),
		[3, 2, 2],
	);
	const ordered = first.flat();
	const lastDietary = ordered.reduce(
		(last, item, index) => (item.mealCategory === MealCategory.STANDARD ? last : index),
		-1,
	);
	const firstStandard = ordered.findIndex(item => item.mealCategory === MealCategory.STANDARD);
	assert.ok(lastDietary < firstStandard);
	assert.equal(new Set(ordered.map(item => item.id)).size, candidates.length);
});

void test("cohort generation handles empty, singleton, and exact boundaries", () => {
	assert.deepEqual(generateNotificationCohorts([], 10, "seed"), []);
	assert.deepEqual(
		generateNotificationCohorts([candidate("only")], 10, "seed").map(group => group.length),
		[1],
	);
	assert.deepEqual(
		generateNotificationCohorts(
			Array.from({ length: 6 }, (_, index) => candidate(`hacker-${index}`)),
			3,
			"seed",
		).map(group => group.length),
		[3, 3],
	);
	assert.throws(() => generateNotificationCohorts([], 0, "seed"), /invalid maximum cohort size/i);
});

void test("a null maximum puts everyone in one dietary-priority-first cohort", () => {
	const candidates = [
		...Array.from({ length: 501 }, (_, index) => candidate(`standard-${index}`)),
		candidate("vegan", MealCategory.VEGAN),
		candidate("halal", MealCategory.HALAL),
	];
	const cohorts = generateNotificationCohorts(candidates, null, "all-in-one-seed");
	assert.equal(cohorts.length, 1);
	assert.equal(cohorts[0]?.length, candidates.length);
	assert.ok(cohorts[0]?.slice(0, 2).every(item => item.mealCategory !== MealCategory.STANDARD));
});
