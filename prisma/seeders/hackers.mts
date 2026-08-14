import { randomBytes } from "node:crypto";
import { faker } from "@faker-js/faker";
import { MealCategory, TShirtSize } from "@prisma/client";

export const generateHackers = (count = 10) =>
	Array.from({ length: count }, () => ({
		id: randomBytes(16).toString("base64url"),
		tShirtSize: faker.helpers.arrayElement(Object.values(TShirtSize)),
		mealCategory: faker.helpers.arrayElement(Object.values(MealCategory)),
		confirmed: faker.datatype.boolean(),
		walkIn: faker.datatype.boolean(),
		acceptanceExpiry: faker.date.future(),
	}));
