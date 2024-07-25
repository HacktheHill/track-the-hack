import { faker } from "@faker-js/faker";
import { count } from "console";

// generates dummy presences
export const presences = () => {
	return {
		key: faker.helpers.slugify(faker.lorem.words(2)),
		value: faker.number.int({ min: 1, max: 10 }),
		label: faker.helpers.arrayElement([
			"Checked In",
			"Breakfast 1",
			"Lunch 1",
			"Dinner 1",
			"Snacks",
			"Snacks 2",
			"Redbull",
			"Breakfast 2",
		]),
	};
};

/**
 * generates an array of presences
 * @param n number of presences to generate
 * @returns [] array of presences
 */
function generatePresences(n = 10) {
	const presenceInfos = [];
	for (let i = 0; i < n; i++) {
		presenceInfos.push(presences());
	}
	return presenceInfos;
}

export { generatePresences };
