import { createHash } from "node:crypto";
import { MealCategory } from "@prisma/client";

export type CohortCandidate = { id: string; mealCategory: MealCategory };

const seededRandom = (seed: string) => {
	let state = createHash("sha256").update(seed).digest().readUInt32LE(0);
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x1_0000_0000;
	};
};

const shuffle = <T>(values: T[], random: () => number) => {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1));
		const current = result[index];
		const target = result[swap];
		if (current === undefined || target === undefined) continue;
		result[index] = target;
		result[swap] = current;
	}
	return result;
};

export const generateNotificationCohorts = (candidates: CohortCandidate[], maximumSize: number, seed: string) => {
	if (!Number.isInteger(maximumSize) || maximumSize < 1) throw new Error("Invalid maximum cohort size");
	if (!candidates.length) return [];
	const random = seededRandom(seed);
	const dietary = shuffle(
		candidates.filter(candidate => candidate.mealCategory !== MealCategory.STANDARD),
		random,
	);
	const standard = shuffle(
		candidates.filter(candidate => candidate.mealCategory === MealCategory.STANDARD),
		random,
	);
	const ordered = [...dietary, ...standard];
	const cohortCount = Math.ceil(ordered.length / maximumSize);
	const baseSize = Math.floor(ordered.length / cohortCount);
	const largerCohorts = ordered.length % cohortCount;
	let offset = 0;
	return Array.from({ length: cohortCount }, (_, index) => {
		const size = baseSize + (index < largerCohorts ? 1 : 0);
		const members = ordered.slice(offset, offset + size);
		offset += size;
		return members;
	});
};
