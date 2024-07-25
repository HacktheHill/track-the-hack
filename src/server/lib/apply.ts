import { Locale } from "@prisma/client";

const countryCodes = [
	"AF",
	"AL",
	"DZ",
	"AS",
	"AD",
	"AO",
	"AI",
	"AQ",
	"AG",
	"AR",
	"AM",
	"AW",
	"AU",
	"AT",
	"AZ",
	"BS",
	"BH",
	"BD",
	"BB",
	"BY",
	"BE",
	"BZ",
	"BJ",
	"BM",
	"BT",
	"BO",
	"BQ",
	"BA",
	"BW",
	"BV",
	"BR",
	"IO",
	"BN",
	"BG",
	"BF",
	"BI",
	"CV",
	"KH",
	"CM",
	"CA",
	"KY",
	"CF",
	"TD",
	"CL",
	"CN",
	"CX",
	"CC",
	"CO",
	"KM",
	"CG",
	"CD",
	"CK",
	"CR",
	"HR",
	"CU",
	"CW",
	"CY",
	"CZ",
	"DK",
	"DJ",
	"DM",
	"DO",
	"EC",
	"EG",
	"SV",
	"GQ",
	"ER",
	"EE",
	"SZ",
	"ET",
	"FK",
	"FO",
	"FJ",
	"FI",
	"FR",
	"GF",
	"PF",
	"TF",
	"GA",
	"GM",
	"GE",
	"DE",
	"GH",
	"GI",
	"GR",
	"GL",
	"GD",
	"GP",
	"GU",
	"GT",
	"GG",
	"GN",
	"GW",
	"GY",
	"HT",
	"HM",
	"VA",
	"HN",
	"HK",
	"HU",
	"IS",
	"IN",
	"ID",
	"IR",
	"IQ",
	"IE",
	"IM",
	"IL",
	"IT",
	"JM",
	"JP",
	"JE",
	"JO",
	"KZ",
	"KE",
	"KI",
	"KP",
	"KR",
	"KW",
	"KG",
	"LA",
	"LV",
	"LB",
	"LS",
	"LR",
	"LY",
	"LI",
	"LT",
	"LU",
	"MO",
	"MG",
	"MW",
	"MY",
	"MV",
	"ML",
	"MT",
	"MH",
	"MQ",
	"MR",
	"MU",
	"YT",
	"MX",
	"FM",
	"MD",
	"MC",
	"MN",
	"ME",
	"MS",
	"MA",
	"MZ",
	"MM",
	"NA",
	"NR",
	"NP",
	"NL",
	"NC",
	"NZ",
	"NI",
	"NE",
	"NG",
	"NU",
	"NF",
	"MP",
	"NO",
	"OM",
	"PK",
	"PW",
	"PS",
	"PA",
	"PG",
	"PY",
	"PE",
	"PH",
	"PN",
	"PL",
	"PT",
	"PR",
	"QA",
	"MK",
	"RO",
	"RU",
	"RW",
	"RE",
	"BL",
	"SH",
	"KN",
	"LC",
	"MF",
	"PM",
	"VC",
	"WS",
	"SM",
	"ST",
	"SA",
	"SN",
	"RS",
	"SC",
	"SL",
	"SG",
	"SX",
	"SK",
	"SI",
	"SB",
	"SO",
	"ZA",
	"GS",
	"SS",
	"ES",
	"LK",
	"SD",
	"SR",
	"SJ",
	"SE",
	"CH",
	"SY",
	"TW",
	"TJ",
	"TZ",
	"TH",
	"TL",
	"TG",
	"TK",
	"TO",
	"TT",
	"TN",
	"TR",
	"TM",
	"TC",
	"TV",
	"UG",
	"UA",
	"AE",
	"GB",
	"US",
	"UM",
	"UY",
	"UZ",
	"VU",
	"VE",
	"VN",
	"VG",
	"VI",
	"WF",
	"EH",
	"YE",
	"ZM",
	"ZW",
];

export const getApplicationQuestions = (locale: string) => {
	const regionNames = new Intl.DisplayNames([locale], {
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
						name: "dateOfBirth",
						type: "date",
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
						required: false,
					},
				],
			},
			{
				name: "skillsAccomplishments",
				questions: [
					{
						name: "hackathonBefore",
						type: "radio",
						options: ["yes", "no"],
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
						name: "name",
						type: "text",
						required: true,
					},
					{
						name: "relation",
						type: "text",
						required: true,
					},
					{
						name: "phoneNumber",
						type: "tel",
						required: true,
					},
				],
			},
			{
				name: "logistics",
				questions: [
					{
						name: "shirt",
						type: "select",
						options: ["XS", "S", "M", "L", "XL", "XXL"],
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
						name: "travelAccommodations",
						type: "select",
						options: ["gta", "montreal", "waterloo", "none"],
						required: false,
					},
					{
						name: "referral",
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
						name: "hthAgreements",
						type: "checkbox",
						required: true,
					},
					{
						name: "hthPromotions",
						type: "checkbox",
						required: true,
					},
					{
						name: "mlhCodeOfConduct",
						type: "checkbox",
						required: true,
					},
					{
						name: "mlhPrivacyTerms",
						type: "checkbox",
						required: true,
					},
					{
						name: "mlhPromotions",
						type: "checkbox",
						required: true,
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
} & (
	| {
			type: "text" | "email" | "tel" | "date" | "url" | "file" | "checkbox";
	  }
	| {
			type: "select" | "multiselect" | "radio";
			options: string[];
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

export type ApplicationQuestionsType = ReturnType<typeof getApplicationQuestions>;
type ExtractFieldType<T> = T extends { questions: infer U } ? U : never;
export type ProcessedField = ExtractFieldType<ApplicationQuestionsType[number]>[number];
export type ProcessedFieldGeneric<T> = ProcessedField & { type: T };
