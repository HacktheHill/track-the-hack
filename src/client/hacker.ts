import { Locale, TShirtSize, type Hacker } from "@prisma/client";

type Field = {
	name: string;
	value: string | boolean | number | null;
	type: "text" | "number" | "email" | "select" | "url" | "textarea";
	options?: string[];
	editable?: boolean;
};

export const getHackerFields = (hackerData: Hacker, acceptance: boolean) => {
	return {
		personal: [
			{
				name: "firstName",
				value: acceptance ? "-" : hackerData.firstName,
				type: "text",
				editable: !acceptance,
			},
			{
				name: "lastName",
				value: acceptance ? "-" : hackerData.lastName,
				type: "text",
				editable: !acceptance,
			},
			{
				name: "email",
				value: acceptance ? "-" : hackerData.email,
				type: "email",
				editable: !acceptance,
			},
			{
				name: "phoneNumber",
				value: acceptance ? "-" : hackerData.phoneNumber,
				type: "text",
				editable: !acceptance,
			},
			{
				name: "preferredLanguage",
				value: hackerData.preferredLanguage,
				options: Object.values(Locale),
				type: "select",
				editable: !acceptance,
			},
			{
				name: "country",
				value: new Intl.DisplayNames(["en"], { type: "region" }).of(hackerData.country)?.toString() ?? null,
				type: "text",
			},
			{
				name: "dateOfBirth",
				value: acceptance ? "-" : hackerData.dateOfBirth?.toISOString().split("T")[0] ?? null,
				type: "text",
			},
		],
		demographics: [
			{
				name: "gender",
				value: acceptance ? "-" : hackerData.gender,
				type: "select",
				options: ["man", "woman", "nonBinary", "preferNotToAnswer"],
			},
			{
				name: "pronouns",
				value: acceptance ? "-" : hackerData.pronouns,
				type: "text",
			},
			{
				name: "raceEthnicity",
				value: acceptance ? "-" : hackerData.raceEthnicity,
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
				value: acceptance ? "-" : hackerData.emergencyContactName,
				type: "text",
				editable: !acceptance,
			},
			{
				name: "emergencyContactRelation",
				value: acceptance ? "-" : hackerData.emergencyContactRelation,
				type: "text",
				editable: !acceptance,
			},
			{
				name: "emergencyContactPhoneNumber",
				value: acceptance ? "-" : hackerData.emergencyContactPhoneNumber,
				type: "text",
				editable: !acceptance,
			},
		],
		logistics: [
			{
				name: "tShirtSize",
				value: hackerData.tShirtSize,
				type: "select",
				options: Object.values(TShirtSize),
				editable: !acceptance,
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
				editable: !acceptance,
			},
			{
				name: "specialAccommodations",
				value: hackerData.specialAccommodations,
				type: "textarea",
				editable: !acceptance,
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
				name: "applicationStatus",
				value: hackerData.applicationStatus,
				type: "select",
				options: ["PENDING", "ACCEPTED", "WAITLISTED", "REJECTED"],
				editable: acceptance,
			},
			{
				name: "acceptanceExpiry",
				value: hackerData.acceptanceExpiry?.toISOString().split("T")[0] ?? null,
				type: "text",
			},
		],
	} as const satisfies Record<string, Field[]>;
};
