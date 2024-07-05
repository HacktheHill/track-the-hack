import { faker } from "@faker-js/faker";
import { Role } from "@prisma/client";
import { hackerInfo } from "./hackerInfos.mjs";
import { Language } from "@prisma/client";
// Generates dummy users
const user = () => {
	const firstName = faker.person.firstName();
	const lastName = faker.person.lastName();
	const name = `${firstName} ${lastName}`;
	const email = faker.internet.email();
	const phoneNumber = faker.phone.number();

	return {
		name,
		email,
		role: Role.HACKER,
		image: "https://i.pravatar.cc/50",
		hackerInfo: {
			create: {
				firstName,
				lastName,
				preferredLanguage: Language.EN,
				phoneNumber,
				email,
				emergencyContactName: "",
				emergencyContactRelationship: "",
				emergencyContactPhoneNumber: "",
				dietaryRestrictions: "",
				accessibilityRequirements: "",
			},
		},
	};
};

/**
 * Generates an array of users
 * @param n number of users to generate
 * @returns [] array of users
 */
function generateUsers(n = 10) {
	const users = [];
	for (let i = 0; i < n; i++) {
		users.push(user());
	}
	return users;
}

export { generateUsers };
