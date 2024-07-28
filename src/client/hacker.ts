import { Locale, TShirtSize, type Hacker } from "@prisma/client";

type Field = {
	name: string;
	value: string | boolean | number | null;
	type: "text" | "number" | "email" | "select" | "url" | "textarea";
	options?: string[];
	editable?: boolean;
};

/*
editable fields:

[
	"firstName",
	"lastName",
	"email",
	"phoneNumber",
	"emergencyContactName",
	"emergencyContactRelation",
	"emergencyContactPhoneNumber",
	"dietaryRestrictions",
	"accessibilityRequirements",
	"preferredLanguage",
	"shirtSize",
]*/

export const getHackerFields = (hackerData: Hacker) => {
	return {
		personal: [
			{
				name: "firstName",
				value: hackerData.firstName,
				type: "text",
				editable: true,
			},
			{
				name: "lastName",
				value: hackerData.lastName,
				type: "text",
				editable: true,
			},
			{
				name: "email",
				value: hackerData.email,
				type: "email",
				editable: true,
			},
			{
				name: "phoneNumber",
				value: hackerData.phoneNumber,
				type: "text",
				editable: true,
			},
			{
				name: "preferredLanguage",
				value: hackerData.preferredLanguage,
				options: Object.values(Locale),
				type: "select",
				editable: true,
			},
			{
				name: "country",
				value: new Intl.DisplayNames(["en"], { type: "region" }).of(hackerData.country)?.toString() ?? null,
				type: "text",
			},
			{
				name: "dateOfBirth",
				value: hackerData.dateOfBirth?.toISOString().split("T")[0] ?? null,
				type: "text",
			},
		],
		demographics: [
			{
				name: "gender",
				value: hackerData.gender,
				type: "select",
				options: ["man", "woman", "nonBinary", "preferNotToAnswer"],
			},
			{
				name: "pronouns",
				value: hackerData.pronouns,
				type: "text",
			},
			{
				name: "raceEthnicity",
				value: hackerData.raceEthnicity,
				type: "text",
			},
		],
		education: [
			{
				name: "currentSchoolOrganization",
				value: hackerData.currentSchoolOrganization,
				type: "text",
			},
			{
				name: "educationLevel",
				value: hackerData.educationLevel,
				type: "select",
				options: ["highSchool", "undergraduate", "graduate"],
			},
			{
				name: "major",
				value: hackerData.major,
				type: "text",
			},
		],
		skillsAccomplishments: [
			{
				name: "hackathonBefore",
				value: hackerData.hackathonBefore ? "true" : "false",
				type: "select",
				options: ["true", "false"],
			},
			{
				name: "hackathonDetails",
				value: hackerData.hackathonDetails,
				type: "textarea",
			},
			{
				name: "programmingLanguagesTechnologies",
				value: hackerData.programmingLanguagesTechnologies,
				type: "textarea",
			},
			{
				name: "projectDescription",
				value: hackerData.projectDescription,
				type: "textarea",
			},
			{
				name: "participationReason",
				value: hackerData.participationReason,
				type: "textarea",
			},
			{
				name: "learningGoals",
				value: hackerData.learningGoals,
				type: "textarea",
			},
		],
		emergencyContact: [
			{
				name: "emergencyContactName",
				value: hackerData.emergencyContactName,
				type: "text",
				editable: true,
			},
			{
				name: "emergencyContactRelation",
				value: hackerData.emergencyContactRelation,
				type: "text",
				editable: true,
			},
			{
				name: "emergencyContactPhoneNumber",
				value: hackerData.emergencyContactPhoneNumber,
				type: "text",
				editable: true,
			},
		],
		logistics: [
			{
				name: "tShirtSize",
				value: hackerData.tShirtSize,
				type: "select",
				options: Object.values(TShirtSize),
				editable: true,
			},
			{
				name: "dietaryRestrictions",
				value: hackerData.dietaryRestrictions,
				type: "text",
				options: [
					"halal",
					"glutenFree",
					"vegetarian",
					"vegan",
					"kosher",
					"lactoseIntolerance",
					"nuts",
					"soy",
					"none",
				],
				editable: true,
			},
			{
				name: "specialAccommodations",
				value: hackerData.specialAccommodations,
				type: "textarea",
				editable: true,
			},
			{
				name: "additionalInfo",
				value: hackerData.additionalInfo,
				type: "textarea",
			},
			{
				name: "travelOrigin",
				value: hackerData.travelOrigin,
				type: "text",
			},
			{
				name: "travelAccommodations",
				value: hackerData.travelAccommodations,
				type: "text",
			},
		],
		other: [
			{
				name: "acceptanceExpiry",
				value: hackerData.acceptanceExpiry?.toISOString().split("T")[0] ?? null,
				type: "text",
			},
		],
	} satisfies Record<string, Field[]>;
};
