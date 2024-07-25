import {
	DietaryRestrictions,
	EducationLevel,
	Gender,
	Locale,
	Pronouns,
	RaceEthnicity,
	ReferralSource,
	RoleName,
	TShirtSize,
	TravelAccommodations,
} from "@prisma/client";
import { z } from "zod";

export const roles = z.enum([RoleName.HACKER, RoleName.SPONSOR, RoleName.ORGANIZER, RoleName.ADMIN]);
export type Roles = z.infer<typeof roles>;
export const roleHierarchy = [RoleName.HACKER, RoleName.SPONSOR, RoleName.ORGANIZER, RoleName.ADMIN];

export const hackerSchema = z.object({
	preferredLanguage: z.nativeEnum(Locale),
	firstName: z.string(),
	lastName: z.string(),
	email: z.string().email(),
	phoneNumber: z.string(),
	country: z.string(),
	dateOfBirth: z.string(),
	emergencyContactName: z.string(),
	emergencyContactRelation: z.string(),
	emergencyContactPhoneNumber: z.string(),
	gender: z.nativeEnum(Gender),
	pronouns: z.nativeEnum(Pronouns),
	raceEthnicity: z.nativeEnum(RaceEthnicity),
	currentSchoolOrganization: z.string(),
	educationLevel: z.nativeEnum(EducationLevel),
	major: z.string(),
	linkedin: z.string().url().optional(),
	github: z.string().url().optional(),
	personalWebsite: z.string().url().optional(),
	hackathonBefore: z.boolean(),
	hackathonDetails: z.string().optional(),
	programmingLanguagesTechnologies: z.string(),
	projectDescription: z.string(),
	participationReason: z.string(),
	learningGoals: z.string(),
	tShirtSize: z.nativeEnum(TShirtSize),
	dietaryRestrictions: z.nativeEnum(DietaryRestrictions),
	specialAccommodations: z.string().optional(),
	additionalInfo: z.string().optional(),
	travelOrigin: z.string().optional(),
	travelAccommodations: z.nativeEnum(TravelAccommodations).optional(),
	referralSource: z.nativeEnum(ReferralSource),
	hthAgreements: z.boolean(),
	hthPromotions: z.boolean(),
	mlhCodeOfConduct: z.boolean(),
	mlhPrivacyTerms: z.boolean(),
	mlhPromotions: z.boolean(),
	hasResume: z.boolean(),
});

export const sponsorshipGmailDraftsSchema = z.object({
	organizerFullName: z.string(),
	companyEmail: z.string().email(),
	subject: z.string(),
	emailHTML: z.string(),
});
