import { z } from "zod";
import { projectInsightsSchema } from "./project-insights";
import { minimumCategorySize } from "./disclosure";
import { normalizationSchema } from "./normalization-schema";

const count = z.number().int().nonnegative();
const label = z
	.string()
	.max(160)
	.refine(value => !/@|https?:\/\//i.test(value), "Contact details are not aggregate labels");
const row = z.object({ label, value: count }).strict();
export const historicalArchiveSchema = z
	.object({
		formatVersion: z.literal(1),
		editions: z
			.array(
				z
					.object({
						id: z.enum(["i", "ii"]),
						normalization: normalizationSchema.optional(),
						devpost: projectInsightsSchema.optional(),
						sourceInventory: z
							.object({
								tables: z.array(z.object({ label, rows: count, columns: count }).strict()),
								fields: z.array(z.object({ label, filled: count, total: count }).strict()),
							})
							.strict()
							.optional(),
						year: z.number().int(),
						sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
						populations: z
							.object({
								registrations: count,
								preEvent: count,
								walkIns: count,
								identities: count.nullable(),
								checkIn: count,
								anyScan: count,
							})
							.strict(),
						funnel: z.array(
							z
								.object({
									key: z.enum(["applications", "accepted", "confirmed", "checkedIn"]),
									value: count,
									unit: z.enum(["rows", "identities"]),
								})
								.strict(),
						),
						turnout: z.object({ from: count, to: count, reconstructed: z.boolean() }).strict(),
						dimensions: z.array(
							z
								.object({
									key: z.string(),
									section: z.enum(["cohorts", "operations", "insights"]),
									total: count,
									missing: count,
									multiSelect: z.boolean(),
									rows: z.array(row),
								})
								.strict(),
						),
						events: z.array(
							z
								.object({
									label,
									group: z.string(),
									people: count,
									units: count,
									instances: count,
									checkedInPeople: count,
								})
								.strict(),
						),
						eventGroups: z
							.array(
								z
									.object({
										group: z.enum(["ALL", "CAREER_FAIR", "FOOD", "SOCIAL", "WORKSHOP"]),
										instances: count,
										rows: count,
										people: count,
										units: count,
									})
									.strict(),
							)
							.optional(),
						stats: z.array(
							z
								.object({
									key: z.string(),
									value: z.number().finite().nonnegative(),
									unit: z.enum(["count", "minutes", "hours", "years"]),
								})
								.strict(),
						),
						quality: z.array(z.object({ key: z.string(), value: count }).strict()),
						mealBounds: z.array(
							z
								.object({
									label,
									firstMin: count,
									firstMax: count,
									secondMin: count,
									secondMax: count,
									floating: count,
									total: count,
								})
								.strict(),
						),
					})
					.strict(),
			)
			.max(2),
	})
	.strict()
	.superRefine((archive, context) => {
		const allowedDimensions = [
			"gender",
			"school",
			"studyLevel",
			"areaOfStudy",
			"discipline",
			"preferredLanguage",
			"travelOrigin",
			"graduationYear",
			"priorHackathonCount",
			"country",
			"countryRegion",
			"travelRegion",
			"travelCountry",
			"racialOrEthnicBackground",
			"acquisitionChannel",
			"tShirtSize",
			"dietaryRestrictions",
			"dietaryWithCheckIn",
			"dietaryWithAnyScan",
			"profileAvailability",
			"attendanceMode",
			"transportSchools",
			"transportOrigins",
			"priorHackathon",
			"age",
			"teamSizes",
			"programmingLanguages",
			"loginProviders",
			"staffRoles",
			"inPersonOrigins",
			"onlineOrigins",
			"missingWalkInAnswers",
			"acceptanceReason",
		];
		const allowedStats = [
			"accommodationResponses",
			"transportRequested",
			"onlineOnly",
			"timedForms",
			"formsWithinHour",
			"formsOverHour",
			"formMedian",
			"formMean",
			"formP90",
			"longFormMedian",
			"longFormMax",
			"ageMean",
			"ageMedian",
			"registeredTeams",
			"peopleInTeams",
			"peopleWithoutTeam",
			"scheduledEvents",
			"foodPeople",
			"staffAssignments",
			"staffPeople",
			"platformAccounts",
			"lookingForwardResponses",
			"ageStdDev",
			"ageMinimum",
			"ageMaximum",
			"ageUnder22",
			"confirmedAnyScan",
			"walkInCheckIn",
			"walkInAnyScan",
			"linkedPlatformAccounts",
			"emailVerifiedAccounts",
			"discordVerificationEvents",
			"discordVerifiedAccounts",
		];
		const allowedQuality = [
			"excludedHackHers",
			"reconstructedRecords",
			"duplicateRegistrations",
			"invalidPriorHackathons",
			"scanWithoutCheckIn",
			"confirmedWithoutScan",
		];
		const fail = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
		if (new Set(archive.editions.map(edition => edition.id)).size !== archive.editions.length)
			fail("Duplicate historical editions");
		for (const edition of archive.editions) {
			if (edition.sourceInventory?.fields.some(field => field.filled > field.total))
				fail("Inconsistent source-field coverage");
			if (edition.eventGroups?.some(group => group.people > group.rows))
				fail("Inconsistent activity-type counts");
			if (
				edition.populations.preEvent + edition.populations.walkIns !== edition.populations.registrations ||
				edition.turnout.to > edition.turnout.from
			)
				fail("Inconsistent historical populations");
			for (const dimension of edition.dimensions) {
				if (!allowedDimensions.includes(dimension.key)) fail("Unknown historical dimension");
				if (
					!dimension.multiSelect &&
					dimension.rows.reduce((sum, row) => sum + row.value, dimension.missing) !== dimension.total
				)
					fail("Inconsistent dimension totals");
				if (
					dimension.rows.some(
						row =>
							row.value > 0 &&
							row.value < minimumCategorySize(dimension.key) &&
							row.label !== "Other / suppressed",
					)
				)
					fail("Unsuppressed small category");
			}
			if (
				edition.stats.some(stat => !allowedStats.includes(stat.key)) ||
				edition.quality.some(row => !allowedQuality.includes(row.key))
			)
				fail("Unknown historical metric");
			for (const bounds of edition.mealBounds)
				if (
					bounds.firstMin + bounds.secondMin + bounds.floating !== bounds.total ||
					bounds.firstMax !== bounds.firstMin + bounds.floating ||
					bounds.secondMax !== bounds.secondMin + bounds.floating
				)
					fail("Inconsistent meal bounds");
		}
	});

export type HistoricalArchive = z.infer<typeof historicalArchiveSchema>;
export type HistoricalEdition = HistoricalArchive["editions"][number];
