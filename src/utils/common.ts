import { Language, RoleName, ShirtSize, Tiers } from "@prisma/client";
import { z } from "zod";

export const roles = z.enum([RoleName.HACKER, RoleName.SPONSOR, RoleName.ORGANIZER]);
export type Roles = z.infer<typeof roles>;
export const roleHierarchy = [RoleName.HACKER, RoleName.SPONSOR, RoleName.ORGANIZER, RoleName.ADMIN];

export const walkInSchema = z.object({
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

export const applySchema = z.object({
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

export const sponsorshipGmailDraftsSchema = z.object({
	organizerFullName: z.string(),
	companyEmail: z.string().email(),
	subject: z.string(),
	emailHTML: z.string(),
});

export const sponsorshipSchema = z.object({
	company_name: z.string().optional(),
	amount: z.number().optional(),
	reps_name: z.string().optional(),
	tier: z
		.enum([Tiers.STARTUP, Tiers.MAYOR, Tiers.PREMIER, Tiers.GOVERNOR, Tiers.PRIME_MINISTER, Tiers.CUSTOM])
		.optional(),
	paid: z.string().optional(),
});

export const addSponsorshipSchema = z.object({
	companyName: z.string(),
	amount: z.number(),
	repName: z.string(),
	tier: z.enum([Tiers.STARTUP, Tiers.MAYOR, Tiers.PREMIER, Tiers.GOVERNOR, Tiers.PRIME_MINISTER, Tiers.CUSTOM]),
	paid: z.string(),
	logo: z.string().optional(),
	date: z.date().optional(),
	invoice: z.string().optional(),
});
