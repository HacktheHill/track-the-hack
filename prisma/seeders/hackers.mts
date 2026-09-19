import { MealCategory, TShirtSize } from "@prisma/client";

const acceptanceExpiry = new Date();
acceptanceExpiry.setDate(acceptanceExpiry.getDate() + 30);

export const hackers = [
	{
		id: "dev-participant-normal-01",
		tShirtSize: TShirtSize.M,
		mealCategory: MealCategory.STANDARD,
		confirmed: false,
		walkIn: false,
		acceptanceExpiry,
	},
	{
		id: "dev-participant-walkin-01",
		tShirtSize: TShirtSize.L,
		mealCategory: MealCategory.VEGAN,
		confirmed: true,
		walkIn: true,
		acceptanceExpiry,
	},
];
