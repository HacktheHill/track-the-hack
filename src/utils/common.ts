import { Language, RoleName, ShirtSize } from "@prisma/client";
import { z } from "zod";

export const roles = z.enum([RoleName.HACKER, RoleName.SPONSOR, RoleName.ORGANIZER, RoleName.ADMIN]);
export type Roles = z.infer<typeof roles>;
export const roleHierarchy = [RoleName.HACKER, RoleName.SPONSOR, RoleName.ORGANIZER, RoleName.ADMIN];

export const hackerSchema = z.object({
	email: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	phoneNumber: z.string(),
	dietaryRestrictions: z.string(),
	accessibilityRequirements: z.string(),
	emergencyContactName: z.string(),
	emergencyContactRelationship: z.string(),
	emergencyContactPhoneNumber: z.string(),
	preferredLanguage: z.enum([Language.EN, Language.FR]).default(Language.EN),
	gender: z.string().optional(),
	university: z.string().optional(),
	studyLevel: z.string().optional(),
	studyProgram: z.string().optional(),
	graduationYear: z.number().min(1900).max(2100).optional(),
	location: z.string().optional(),
	shirtSize: z.enum([ShirtSize.S, ShirtSize.M, ShirtSize.L, ShirtSize.XL, ShirtSize.XXL]).default(ShirtSize.M),
	numberOfPreviousHackathons: z.number().optional(),
	linkGithub: z.string().optional(),
	linkLinkedin: z.string().optional(),
	linkPersonalSite: z.string().optional(),
});

export const fields = [
	{
		name: "email",
		type: "email",
		required: true,
	},
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
		name: "phoneNumber",
		type: "tel",
		required: true,
	},
	{
		name: "dietaryRestrictions",
		type: "text",
		required: false,
	},
	{
		name: "accessibilityRequirements",
		type: "text",
		required: false,
	},
	{
		name: "emergencyContactName",
		type: "text",
		required: true,
	},
	{
		name: "emergencyContactRelationship",
		type: "text",
		required: true,
	},
	{
		name: "emergencyContactPhoneNumber",
		type: "tel",
		required: true,
	},
	{
		name: "preferredLanguage",
		type: "select",
		options: ["en", "fr"],
		required: false,
	},
	{
		name: "gender",
		type: "text",
		required: false,
	},
	{
		name: "university",
		type: "text",
		required: false,
	},
	{
		name: "studyLevel",
		type: "text",
		required: false,
	},
	{
		name: "studyProgram",
		type: "text",
		required: false,
	},
	{
		name: "graduationYear",
		type: "number",
		required: false,
	},
	{
		name: "location",
		type: "text",
		required: false,
	},
	{
		name: "shirtSize",
		type: "select",
		options: ["S", "M", "L", "XL", "XXL"],
		required: false,
	},
	{
		name: "numberOfPreviousHackathons",
		type: "number",
		required: false,
	},
	{
		name: "linkGithub",
		type: "url",
		required: false,
	},
	{
		name: "linkLinkedin",
		type: "url",
		required: false,
	},
	{
		name: "linkPersonalSite",
		type: "url",
		required: false,
	},
	{
		name: "resume",
		type: "file",
		required: false,
	},
] as const satisfies {
	name: string;
	type: keyof typeof patterns;
	required: boolean;
	options?: string[];
}[];

export const patterns = {
	tel: "^\\s*(?:\\+?(\\d{1,3}))?[-. (]*(\\d{3})[-. )]*(\\d{3})[-. ]*(\\d{4})(?: *x(\\d+))?\\s*$",
	url: undefined,
	number: "^\\d+$",
	select: undefined,
	file: undefined,
	email: undefined,
	text: undefined,
} as const satisfies Record<string, string | undefined>;

export const sponsorshipGmailDraftsSchema = z.object({
	organizerFullName: z.string(),
	companyEmail: z.string().email(),
	subject: z.string(),
	emailHTML: z.string(),
});
