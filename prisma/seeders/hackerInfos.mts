import { faker } from "@faker-js/faker";

// generates dummy hacker's info
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hackerInfo = ({ email, firstName, lastName, phoneNumber }: { [key: string]: any }) => {
	if (!firstName) {
		firstName = faker.person.firstName();
	}
	if (!lastName) {
		lastName = faker.person.lastName();
	}
	if (!email) {
		email = `${firstName}.${lastName}@email.com`;
	}
	if (!phoneNumber) {
		phoneNumber = faker.phone.number();
	}

	return {
		preferredLanguage: faker.helpers.arrayElement(["EN", "FR"]),
		email,
		firstName,
		lastName,
		gender: faker.helpers.arrayElement(["She/her", "He/him", "Prefer not to say", "They/them"]),
		phoneNumber,
		university: faker.helpers.arrayElement([
			"University of Ottawa",
			"Carleton University",
			"University of Waterloo",
		]),
		studyLevel: faker.helpers.arrayElement(["undergraduate", "postgraduate", "masters"]),
		studyProgram: faker.helpers.arrayElement([
			"Computer Science",
			"Software Engineering",
			"Computer Engineering",
			"Electrical Engineering",
			"Data Science",
		]),
		graduationYear: faker.helpers.arrayElement([2023, 2024, 2025, 2026, 2027]),
		attendanceType: faker.helpers.arrayElement(["IN_PERSON", "ONLINE"]),
		location: faker.helpers.arrayElement(["Ottawa", "Kitchener", "Toronto", "Montreal"]),
		transportationRequired: faker.helpers.arrayElement([true, false]),
		dietaryRestrictions: faker.helpers.arrayElement([
			"None",
			"Vegan",
			"Vegetarian",
			"Halal",
			"Gluten Free",
			"Kosher",
		]),
		accessibilityRequirements: faker.helpers.arrayElement(["None", "Vision", "Hearing", "Mobility"]),
		shirtSize: faker.helpers.arrayElement(["S", "M", "L", "XL", "XXL"]),
		emergencyContactName: faker.person.firstName(),
		emergencyContactRelationship: faker.helpers.arrayElement(["Mother", "Father", "Sibling", "Friend"]),
		emergencyContactPhoneNumber: faker.phone.number(),
		numberOfPreviousHackathons: faker.helpers.arrayElement([0, 1, 2, 3, 4, 5]),
		confirmed: faker.helpers.arrayElement([true, false]),
		unsubscribed: faker.helpers.arrayElement([true, false]),
		onlyOnline: faker.helpers.arrayElement([true, false]),
		walkIn: faker.helpers.arrayElement([true, false]),
		winner: faker.helpers.arrayElement([true, false]),
	};
};

/**
 * generates an array of hackerInfos
 * @param n number of hackerInfos to generate
 * @returns [] array of hackerInfos
 */
function generateHackerInfos(n = 10) {
	const hackerInfos = [];
	for (let i = 0; i < n; i++) {
		hackerInfos.push(hackerInfo({}));
	}
	return hackerInfos;
}

export { generateHackerInfos };
