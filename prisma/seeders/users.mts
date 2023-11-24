import { faker } from "@faker-js/faker";
import { Role } from "@prisma/client";
import { hackerInfo } from "./hackerInfos.mjs";

//generates dummy users
let user = () => {
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
			create: { ...hackerInfo({ email, firstName, lastName, phoneNumber }) },
		},
	};
};

/**
 * generates an array of users
 * @param n number of users to generate
 * @returns [] array of users
 */
function generateUsers(n = 10) {
	let users = [];
	for (let i = 0; i < n; i++) {
		users.push(user());
	}
	return users;
}

export { generateUsers };
