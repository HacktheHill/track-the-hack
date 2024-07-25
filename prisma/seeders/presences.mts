import { faker } from "@faker-js/faker";
import { count } from "console";

// generates dummy presences
export const presences = () => {
	return {
		id: faker.string.uuid(),
		key: faker.helpers.arrayElement([
			"checkedIn",
			"breakfast1",
			"lunch1",
			"dinner1",
			"snacks",
			"snacks2",
			"redbull",
			"breakfast2",
		]),
		value: faker.datatype.boolean(),
		count: faker.number.int({ min: 1, max: 10 }),
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
