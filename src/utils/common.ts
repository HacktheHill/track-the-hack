import { z } from "zod";
import { Language, Role, ShirtSize } from "@prisma/client";

export const roles = z.enum([Role.HACKER, Role.SPONSOR, Role.ORGANIZER]);
export type Roles = z.infer<typeof roles>;

export const applicationInfoSchema = z.object({
	email: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	phoneNumber: z.string(),
	age: z.number().min(0),
	pronouns : z.string(),
	levelOfStudy: z.string(),
	school: z.string(),
	program: z.string(),
	graduationYear: z.number().min(1900).max(2100),
	hackathonsAttended: z.number().min(0),
	inPerson: z.boolean(),
	isTransportRequired: z.boolean(),
	dietaryRestrictions: z.string(),
	shirtSize: z.enum([ShirtSize.S, ShirtSize.M, ShirtSize.L, ShirtSize.XL, ShirtSize.XXL]).default(ShirtSize.M),
	accessibilityRequirements: z.string(),
	contactFullName: z.string(),
	contactRelationship: z.string(),
	contactPhoneNumber: z.string(),
	applicationAnswer: z.string(),
	linkedIn: z.string(),
	github: z.string(),
	personalWebsite: z.string(),
	resumePath: z.string(),
});

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
