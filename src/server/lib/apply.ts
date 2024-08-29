import { Locale, TShirtSize } from "@prisma/client";
import { countryCodes } from "../../utils/common";

export const getApplicationQuestions = (locale: keyof typeof Locale) => {
	const regionNames = new Intl.DisplayNames([locale.toLocaleLowerCase()], {
		type: "region",
	});

	return (
		[
			{
				name: "introduction",
				questions: [],
			},
			{
				name: "preferredLanguage",
				questions: [
					{
						name: "preferredLanguage",
						type: "radio",
						options: Object.keys(Locale),
						required: true,
					},
				],
			},
			{
				name: "personal",
				questions: [
					{
						name: "firstName",
						type: "text",
						required: true,
					},
					{
						name: "lastName",
						type: "text",
						required: true,
					},
					{
						name: "email",
						type: "email",
						required: true,
					},
					{
						name: "phoneNumber",
						type: "tel",
						required: true,
					},
					{
						name: "country",
						type: "select",
						options: countryCodes,
						required: true,
					},
					{
						name: "age",
						type: "number",
						required: true,
					},
				],
			},
			{
				name: "demographics",
				questions: [
					{
						name: "gender",
						type: "select",
						options: ["man", "woman", "nonBinary", "other", "preferNotToAnswer"],
						required: false,
					},
					{
						name: "pronouns",
						type: "select",
						options: ["sheHer", "heHim", "theyThem", "other", "preferNotToAnswer"],
						required: false,
					},
					{
						name: "raceEthnicity",
						type: "select",
						options: [
							"caucasian",
							"southAsian",
							"african",
							"eastAsian",
							"hispanic",
							"middleEastern",
							"nativeAmerican",
							"other",
							"preferNotToAnswer",
						],
						required: false,
					},
				],
			},
			{
				name: "education",
				questions: [
					{
						name: "currentSchoolOrganization",
						type: "typeahead",
						required: true,
						url: "/schools.txt",
					},
					{
						name: "educationLevel",
						type: "select",
						options: ["highSchool", "undergraduate", "graduate", "other"],
						required: true,
					},
					{
						name: "major",
						type: "text",
						required: true,
					},
				],
			},
			{
				name: "links",
				questions: [
					{
						name: "linkedin",
						type: "url",
						required: false,
					},
					{
						name: "github",
						type: "url",
						required: false,
					},
					{
						name: "personalWebsite",
						type: "url",
						required: false,
					},
					{
						name: "resume",
						type: "file",
						required: true,
					},
				],
			},
			{
				name: "skillsAccomplishments",
				questions: [
					{
						name: "hackathonBefore",
						type: "radio",
						options: ["true", "false"],
						required: true,
					},
					{
						name: "hackathonDetails",
						type: "textarea",
						charLimit: 750,
						required: true,
					},
					{
						name: "programmingLanguagesTechnologies",
						type: "textarea",
						charLimit: 750,
						required: true,
					},
					{
						name: "projectDescription",
						type: "textarea",
						charLimit: 1500,
						required: true,
					},
					{
						name: "participationReason",
						type: "textarea",
						charLimit: 1500,
						required: true,
					},
					{
						name: "learningGoals",
						type: "textarea",
						charLimit: 1500,
						required: true,
					},
				],
			},
			{
				name: "emergencyContact",
				questions: [
					{
						name: "emergencyContactName",
						type: "text",
						required: true,
					},
					{
						name: "emergencyContactRelation",
						type: "text",
						required: true,
					},
					{
						name: "emergencyContactPhoneNumber",
						type: "tel",
						required: true,
					},
				],
			},
			{
				name: "logistics",
				questions: [
					{
						name: "tShirtSize",
						type: "select",
						options: Object.keys(TShirtSize),
						required: true,
					},
					{
						name: "dietaryRestrictions",
						type: "select",
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
							"other",
						],
						required: true,
					},
					{
						name: "specialAccommodations",
						type: "textarea",
						charLimit: 1500,
						required: false,
					},
					{
						name: "additionalInfo",
						type: "textarea",
						charLimit: 1500,
						required: false,
					},
					{
						name: "travelOrigin",
						type: "text",
						required: false,
					},
					{
						name: "referralSource",
						type: "multiselect",
						options: [
							"studentOrganizations",
							"friends",
							"universityWebsite",
							"linkedin",
							"instagram",
							"tiktok",
							"facebook",
							"universityEmail",
							"classAnnouncements",
							"hackathonWebsites",
							"flyers",
							"professors",
							"careerServices",
							"onlineForums",
							"alumniNetworks",
							"other",
						],
						required: false,
					},
				],
			},
			{
				name: "agreements",
				questions: [
					{
						name: "agreements",
						type: "checkbox",
						required: true,
						links: [
							"https://docs.google.com/document/d/1thE_Ia595Cz9YaD8gTbyZ3gnZiBSgkLgl0wwGSANczc/edit",
							"https://docs.google.com/document/d/1hhsl6WrrZtDz_mbeW7wDBS70Ozrbe6-aL06vqIh2550/edit",
							"https://docs.google.com/document/u/2/d/149kUCf4PXmd2GvIgGNt8MXiMz6BJfDiIEMdNzUti_Kc/edit",
							"https://docs.google.com/document/d/1aacZOxbDqiBnmIOq31NpHUggXXMvUqoVFR_d7IAuujE/edit",
							"https://docs.google.com/document/d/1y7zP5kBHRrNMOxx_0JAz8NcLBHWFWe8OtsbOOosBs60/edit",
						],
					},
					{
						name: "promotions",
						type: "checkbox",
						required: false,
					},
				],
			},
		] as const satisfies {
			name: string;
			questions: Field[];
		}[]
	).map(page => {
		return {
			...page,
			title: `${page.name}.title`,
			description: `${page.name}.description`,
			questions: page.questions.map(question => {
				const options =
					"options" in question
						? (Object.fromEntries(
								question.options.map((option: string) => {
									if (
										page.name === "personal" &&
										question.name === "country" &&
										typeof option === "string"
									) {
										return [option, regionNames.of(option) ?? option];
									}
									return [option, `${page.name}.${question.name}.options.${option}`];
								}),
							) satisfies Record<string, string>)
						: {};

				return {
					...question,
					label: `${page.name}.${question.name}.label`,
					options,
				};
			}),
		};
	});
};

type Field = {
	name: string;
	required: boolean;
	links?: readonly string[];
} & (
	| {
			type: "text" | "email" | "tel" | "number" | "url" | "file" | "checkbox";
	  }
	| {
			type: "select" | "multiselect" | "radio";
			options: readonly string[];
	  }
	| {
			type: "textarea";
			charLimit: number;
	  }
	| {
			type: "typeahead";
			url: string;
	  }
);

export type PageName = ReturnType<typeof getApplicationQuestions>[number]["name"];
export type ApplicationQuestionsType = ReturnType<typeof getApplicationQuestions>;
type ExtractFieldType<T> = T extends { questions: infer U } ? U : never;
export type ProcessedField = ExtractFieldType<ApplicationQuestionsType[number]>[number];
export type ProcessedFieldGeneric<T> = ProcessedField & { type: T };
