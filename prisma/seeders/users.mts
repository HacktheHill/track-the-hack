import { faker } from "@faker-js/faker";
import { RoleName } from "@prisma/client";
import { generateHackerData } from "./hackers.mjs";

// Generates dummy users
const user = () => {
	const firstName = faker.person.firstName();
	const lastName = faker.person.lastName();
	const name = `${firstName} ${lastName}`;
	const email = faker.internet.email();

	return {
		name,
		email,
		roles: {
			connect: [{ name: RoleName.HACKER }],
		},
		image: "https://i.pravatar.cc/50",
		hacker: generateHackerData(),
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
