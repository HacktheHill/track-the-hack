import { faker } from "@faker-js/faker";

// generates dummy presence info
export const presenceInfo = () => {
	return {
		id: faker.string.uuid(),
		checkedIn: faker.helpers.arrayElement([true, false]),
		breakfast1: faker.helpers.arrayElement([true, false]),
		lunch1: faker.helpers.arrayElement([true, false]),
		dinner1: faker.helpers.arrayElement([true, false]),
		snacks: faker.helpers.arrayElement([true, false]),
		snacks2: faker.helpers.arrayElement([true, false]),
		redbull: faker.helpers.arrayElement([true, false]),
		breakfast2: faker.helpers.arrayElement([true, false]),
		lunch22: faker.helpers.arrayElement([true, false]),
	};
};

/**
 * generates an array of hackerInfos
 * @param n number of hackerInfos to generate
 * @returns [] array of hackerInfos
 */
function generatePresenceInfos(n = 10) {
	const presenceInfos = [];
	for (let i = 0; i < n; i++) {
		presenceInfos.push(presenceInfo());
	}
	return presenceInfos;
}

export { generatePresenceInfos };
