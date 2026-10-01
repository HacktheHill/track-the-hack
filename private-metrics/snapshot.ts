import { z } from "zod";
import { MealCategory, TShirtSize } from "@prisma/client";
import { historicalArchiveSchema } from "./history";
import {
	sheetMetricsSnapshotSchema,
	communicationsMetricsSnapshotSchema,
	devpostMetricsSnapshotSchema,
} from "@/server/services/external-metrics";

const count = z.number().int().nonnegative();
const nullableCount = count.nullable();
const conversion = z
	.object({
		from: nullableCount,
		to: nullableCount,
		dropOff: z.number().int().nullable(),
		rate: z.number().nullable(),
	})
	.strict();
const snapshot = <T extends z.ZodTypeAny>(payload: T) =>
	z.object({ capturedAt: z.string().datetime(), payload }).strict().nullable();
// Every accepted key is aggregate-shaped. Unknown fields fail closed, including
// names, emails, participant IDs, credentials, and unreviewed future API fields.
export const archiveDashboardSchema = z
	.object({
		formatVersion: z.literal(1),
		capturedAt: z.string().datetime(),
		history: historicalArchiveSchema.optional(),
		metrics: z
			.object({
				provisioned: count,
				confirmed: count,
				walkIn: count,
				checkedIn: count,
				presences: count,
				attendanceOutcomes: z
					.object({
						confirmedAttended: count,
						confirmedAbsent: count,
						attendedWithoutConfirmation: count,
						attendedWalkIns: count,
					})
					.strict(),
				rsvp: z.object({ confirmed: count, declined: count, pending: count }).strict(),
				attendanceData: z.array(
					z
						.object({
							eventId: z.string(),
							label: z.string(),
							labelFr: z.string().optional(),
							start: z.string().datetime().optional(),
							group: z.string().optional(),
							uniqueParticipants: count,
							recordedUnits: count,
						})
						.strict(),
				),
				engagementData: z.array(
					z.object({ key: z.enum(["none", "one", "twoToThree", "fourPlus"]), participants: count }).strict(),
				),
				mealCategoryData: z.array(
					z
						.object({
							mealCategory: z.nativeEnum(MealCategory),
							_count: z.object({ mealCategory: count }).strict(),
						})
						.strict(),
				),
				tShirtSizeData: z.array(
					z
						.object({
							tShirtSize: z.nativeEnum(TShirtSize),
							_count: z.object({ tShirtSize: count }).strict(),
						})
						.strict(),
				),
				attendanceIntegrity: z
					.object({
						issuedPassesWithoutCheckIn: count,
						positivePresenceWithoutCheckIn: count,
						visibleCheckInEvents: count,
					})
					.strict(),
				funnel: z
					.object({
						applications: nullableCount,
						accepted: nullableCount,
						acceptanceEmailsSesAccepted: nullableCount,
						confirmed: count,
						checkedIn: count,
						devpostProjects: count,
						devpostRegistrants: count,
						devpostActiveRegistrants: count,
						devpostSubmitters: count,
						devpostSubmittedProjects: count,
						devpostPublicProjects: count,
					})
					.strict(),
				conversions: z
					.object({
						participation: z
							.object({
								applicationToAccepted: conversion,
								acceptedToConfirmed: conversion,
								confirmedToAttended: conversion,
							})
							.strict(),
						devpost: z
							.object({
								registrantToActive: conversion,
								activeToSubmitter: conversion,
								submittedToPublicProject: conversion,
								publicToJudgingProject: conversion,
							})
							.strict(),
					})
					.strict(),
				dataQuality: z
					.object({
						sheetRows: nullableCount,
						sheetLinkedRows: nullableCount,
						sheetUnlinkedRows: nullableCount,
						duplicateApplicationRows: nullableCount,
						devpostMatchedRegistrants: nullableCount,
						devpostUnmatchedRegistrants: nullableCount,
						devpostMatchedSubmitters: nullableCount,
						devpostProjectImportGap: nullableCount,
					})
					.strict(),
				externalMetrics: z
					.object({
						sheet: snapshot(sheetMetricsSnapshotSchema),
						communications: snapshot(communicationsMetricsSnapshotSchema),
						devpost: snapshot(devpostMetricsSnapshotSchema),
					})
					.strict(),
			})
			.strict(),
	})
	.strict();

export type ArchiveDashboard = z.infer<typeof archiveDashboardSchema>;
export type DashboardData = Omit<ArchiveDashboard["metrics"], "externalMetrics" | "engagementData"> & {
	engagementData: Array<{ key: string; participants: number }>;
	externalMetrics: {
		[K in keyof ArchiveDashboard["metrics"]["externalMetrics"]]:
			| null
			| (Omit<NonNullable<ArchiveDashboard["metrics"]["externalMetrics"][K]>, "capturedAt"> & {
					capturedAt: Date;
			  });
	};
};
