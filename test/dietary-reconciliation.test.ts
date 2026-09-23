import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory } from "@prisma/client";
import { reconcileDietaryCategories, type DietaryReconciliationRepository } from "@/server/services/dietary-reconciliation";

const first = "a".repeat(32);
const second = "b".repeat(32);

void test("dietary reconciliation accepts only existing opaque IDs and meal categories", async () => {
	const calls: unknown[] = [];
	const repository: DietaryReconciliationRepository = {
		updateExistingMealCategories: participants => {
			calls.push(participants);
			return Promise.resolve({ missingIds: [] });
		},
	};
	const input = { participants: [{ id: first, mealCategory: MealCategory.OTHER }] };
	assert.deepEqual(await reconcileDietaryCategories(repository, input), { processed: 1, missingIds: [] });
	assert.deepEqual(calls, [input.participants]);
	await assert.rejects(reconcileDietaryCategories(repository, { participants: [input.participants[0], input.participants[0]] }), /Duplicate participant ID/);
	await assert.rejects(reconcileDietaryCategories(repository, { participants: [{ ...input.participants[0], walkIn: true }] }), /unrecognized_key/);
	await assert.rejects(reconcileDietaryCategories(repository, { participants: [{ id: "123", mealCategory: MealCategory.OTHER }] }), /too_small/);
	assert.equal(calls.length, 1);
});

void test("a missing participant cannot be counted as reconciled", async () => {
	const repository: DietaryReconciliationRepository = {
		updateExistingMealCategories: () => Promise.resolve({ missingIds: [second] }),
	};
	assert.deepEqual(await reconcileDietaryCategories(repository, {
		participants: [{ id: first, mealCategory: MealCategory.VEGAN }, { id: second, mealCategory: MealCategory.OTHER }],
	}), { processed: 0, missingIds: [second] });
});
