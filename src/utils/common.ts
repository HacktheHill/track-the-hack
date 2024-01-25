import { TypeOf, z } from "zod";
import { Language, ShirtSize, Tiers } from "@prisma/client";


export const Role = {HACKER : "HACKER", ORGANIZER : "ORGANIZER", SPONSOR : "SPONSOR"};
export type Roles = {HACKER : "HACKER", ORGANIZER : "ORGANIZER", SPONSOR : "SPONSOR"};
export const Tag = {CONFIRMED : "CONFIRMED"}

//TO-DO: Replace all instances of Walk-in with the other Info schemas
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

export const personalInfoSchema = z.object({
	preferredLanguage: z.enum([Language.EN, Language.FR]).default(Language.EN),
	email: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	gender: z.string().default("Prefer not to say"),
	phoneNumber: z.string(),
	city: z.string().nullable(),
	hackerId: z.string().nullable().optional(), // Assuming hackerId can be optional
	sponsorId: z.string().nullable().optional(), // Assuming sponsorId can be optional
	organizerId: z.string().nullable().optional(), // Assuming organizerId can be optional
});

const emergencyContactSchema = z.object({
	name: z.string().nullable(),
	phoneNumber: z.string().nullable(),
	relationship: z.string().nullable(),
	hackerId: z.string().nullable().optional(), // Assuming hackerId can be optional
  });

export const educationSchema = z.object({
	university: z.string().nullable(),
	studyLevel: z.string().nullable(),
	studyProgram: z.string().nullable(),
	graduationYear: z.number().nullable(),
	hackerId: z.string().nullable().optional(), // Assuming hackerId can be optional
});
  
const SocialsSchema = z.object({
	hackerId: z.string().nullable().optional(), // Assuming hackerId can be optional
	github: z.string().nullable(),
	linkedin: z.string().nullable(),
	personalSite: z.string().nullable(),
});

const PreferencesSchema = z.object({
  id: z.string().optional(),
  dietaryRestrictions: z.string().nullable(),
  accessibilityRequirements: z.string().nullable(),
  transportationRequired: z.boolean().default(false),
  attendanceType: z.enum(["IN_PERSON"]).default("IN_PERSON"),
  shirtSize: z.enum([ShirtSize.S, ShirtSize.M, ShirtSize.L, ShirtSize.XL, ShirtSize.XXL]).default(ShirtSize.M),
  hackerId: z.string().nullable().optional(),
  emailUnsubscribeId: z.string().nullable(),
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
