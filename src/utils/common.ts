import { ApplicationStatus, Locale, RoleName, TShirtSize, TravelAccommodations } from "@prisma/client";
import { z } from "zod";

export const roleHierarchy: RoleName[] = [RoleName.HACKER, RoleName.SPONSOR, RoleName.ORGANIZER, RoleName.ADMIN];

// prettier-ignore
export const countryCodes = [
	"CA", "US", "AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW",
	"AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO",
	"BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "KY",
	"CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM", "CG", "CD", "CK", "CR", "HR", "CU",
	"CW", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ",
	"ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE", "GH",
	"GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA",
	"HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP",
	"JE", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR",
	"LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR",
	"MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR",
	"NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MP", "NO", "OM", "PK", "PW",
	"PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "MK", "RO", "RU",
	"RW", "RE", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST", "SA", "SN",
	"RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES", "LK",
	"SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO",
	"TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "UM", "UY", "UZ", "VU",
	"VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW",
] as const;

const validatePDFContent = (file: File) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => {
			const content = reader.result as string;
			if (content.startsWith("%PDF-")) {
				resolve(true);
			} else {
				resolve(false);
			}
		};

		reader.onerror = () => {
			reject(new Error("Error reading the file"));
		};

		reader.readAsText(file);
	});
};

export const preferredLanguageSchema = z.object({
	preferredLanguage: z.nativeEnum(Locale),
});

export const personalSchema = z.object({
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	email: z.string().email(),
	phoneNumber: z.string().min(1),
	country: z.enum(countryCodes),
	dateOfBirth: z
		.date()
		.refine(date => date < new Date(), {
			params: { i18n: "dateOfBirth.future" },
		})
		.refine(date => new Date().getFullYear() - date.getFullYear() >= 15, {
			params: { i18n: "dateOfBirth.age" },
		}),
	age: z
		.number()
		.int()
		.refine(age => age >= 15, {
			params: { i18n: "age.min" },
		}),
});

export const demographicsSchema = z.object({
	gender: z.string().optional(),
	pronouns: z.string().optional(),
	raceEthnicity: z.string().optional(),
});

export const educationSchema = z.object({
	currentSchoolOrganization: z.string().min(1),
	educationLevel: z.string().min(1),
	major: z.string().min(1),
});

export const linksSchema = z.object({
	linkedin: z.string().url().optional(),
	github: z.string().url().optional(),
	personalWebsite: z.string().url().optional(),
	resume: z
		.instanceof(File)
		.refine(file => !!file && file.size <= 2 * 1024 * 1024, {
			params: { i18n: "resume.size" },
		})
		.refine(file => !!file && file.type === "application/pdf", {
			params: { i18n: "resume.format" },
		})
		.refine(file => validatePDFContent(file), {
			params: { i18n: "resume.content" },
		}),
});

export const skillsAccomplishmentsSchema = z.object({
	hackathonBefore: z.boolean(),
	hackathonDetails: z.string().max(750).min(1),
	programmingLanguagesTechnologies: z.string().max(750).min(1),
	projectDescription: z.string().max(1500).min(1),
	participationReason: z.string().max(1500).min(1),
	learningGoals: z.string().max(1500).min(1),
});

export const emergencyContactSchema = z.object({
	emergencyContactName: z.string().min(1),
	emergencyContactRelation: z.string().min(1),
	emergencyContactPhoneNumber: z.string().min(1),
});

export const logisticsSchema = z.object({
	tShirtSize: z.nativeEnum(TShirtSize),
	dietaryRestrictions: z.string(),
	specialAccommodations: z.string().max(1500).optional(),
	additionalInfo: z.string().max(1500).optional(),
	travelOrigin: z.string().optional(),
	travelAccommodations: z.nativeEnum(TravelAccommodations).optional(),
	referralSource: z.string().optional(),
});

export const agreementsSchema = z.object({
	hthAgreements: z.literal(true),
	hthPromotions: z.boolean(),
	mlhCodeOfConduct: z.literal(true),
	mlhPrivacyTerms: z.literal(true),
	mlhPromotions: z.boolean(),
});

export const pageSchemas = {
	preferredLanguage: preferredLanguageSchema,
	personal: personalSchema,
	demographics: demographicsSchema,
	education: educationSchema,
	links: linksSchema,
	skillsAccomplishments: skillsAccomplishmentsSchema,
	emergencyContact: emergencyContactSchema,
	logistics: logisticsSchema,
	agreements: agreementsSchema,
};

export const hackerSchema = z.object({
	...preferredLanguageSchema.shape,
	...personalSchema.shape,
	...demographicsSchema.shape,
	...educationSchema.shape,
	...linksSchema.omit({ resume: true }).shape,
	...skillsAccomplishmentsSchema.shape,
	...emergencyContactSchema.shape,
	...logisticsSchema.shape,
	...agreementsSchema.shape,
	hasResume: z.boolean().default(false),
	applicationStatus: z.nativeEnum(ApplicationStatus).default(ApplicationStatus.PENDING),
});

export const sponsorshipGmailDraftsSchema = z.object({
	organizerFullName: z.string(),
	companyEmail: z.string().email(),
	subject: z.string(),
	emailHTML: z.string(),
});
