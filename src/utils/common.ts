import { z } from "zod";
import { Language, Role, ShirtSize } from "@prisma/client";

export const roles = z.enum([Role.HACKER, Role.SPONSOR, Role.ORGANIZER]);
export type Roles = z.infer<typeof roles>;

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

export const sponsorshipGmailDraftsSchema = z.object({
	organizerFullName: z.string(),
	companyEmail: z.string().email(),
	subject: z.string(),
	emailHTML: z.string(),
});
