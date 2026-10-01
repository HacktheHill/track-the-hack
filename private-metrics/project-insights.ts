import { z } from "zod";

const count = z.number().int().nonnegative();
const label = z
	.string()
	.min(1)
	.max(160)
	.refine(value => !/@|https?:\/\/|\b\d{7,}\b/i.test(value));
const row = z.object({ label, value: count }).strict();
const selections = z.object({ answeredProjects: count, suppressedLabels: count, rows: z.array(row) }).strict();
export const projectCoverageKeys = [
	"description",
	"tryItOut",
	"video",
	"images",
	"builtWith",
	"prizeOptIn",
	"teamSchools",
] as const;
export const projectInsightsSchema = z
	.object({
		kind: z.literal("devpost-project-insights"),
		sourceMethod: z.enum(["project-export", "organizer-pages"]).optional(),
		capturedAt: z.string().datetime(),
		sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
		registrants: count,
		submitters: count,
		teamUpRequests: count,
		submittedProjects: count,
		publicProjects: count,
		hiddenProjects: count,
		draftProjects: count,
		teamMemberships: count,
		teamSizeAnsweredProjects: count,
		teamSizes: z.array(row),
		technologies: selections,
		prizes: selections,
		coverage: z.array(
			z
				.object({
					key: z.enum(projectCoverageKeys),
					answeredProjects: count.nullable(),
				})
				.strict(),
		),
		duplicateExportRows: count,
	})
	.strict()
	.superRefine((value, context) => {
		const fail = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
		if (
			value.publicProjects + value.hiddenProjects !== value.submittedProjects ||
			value.submitters > value.registrants
		)
			fail("Inconsistent Devpost populations");
		if (
			value.teamSizeAnsweredProjects > value.submittedProjects ||
			value.teamMemberships < value.teamSizeAnsweredProjects ||
			value.teamMemberships > 99 * value.teamSizeAnsweredProjects ||
			value.teamSizes.reduce((sum, row) => sum + row.value, 0) !== value.teamSizeAnsweredProjects
		)
			fail("Inconsistent project team sizes");
		for (const rows of [value.teamSizes, value.technologies.rows, value.prizes.rows]) {
			if (new Set(rows.map(row => row.label.toLowerCase())).size !== rows.length)
				fail("Duplicate project categories");
			if (rows.some(row => row.value < 5 && row.label !== "Other / suppressed"))
				fail("Unsuppressed small project category");
			if (rows.some(row => row.value > value.submittedProjects)) fail("Project category exceeds its population");
		}
		if (value.teamSizes.some(row => row.label !== "Other / suppressed" && !/^[1-9]\d?$/.test(row.label)))
			fail("Invalid team-size label");
		for (const selection of [value.technologies, value.prizes])
			if (
				selection.answeredProjects > value.submittedProjects ||
				selection.rows.some(row => row.value > selection.answeredProjects || row.value < 5)
			)
				fail("Inconsistent project selection coverage");
		if (
			value.coverage.length !== projectCoverageKeys.length ||
			new Set(value.coverage.map(row => row.key)).size !== value.coverage.length ||
			value.coverage.some(
				row => row.answeredProjects !== null && row.answeredProjects > value.submittedProjects,
			) ||
			value.coverage.some(
				row =>
					row.answeredProjects === null &&
					(value.sourceMethod !== "organizer-pages" || row.key !== "teamSchools"),
			) ||
			value.coverage.find(row => row.key === "builtWith")?.answeredProjects !==
				value.technologies.answeredProjects ||
			value.coverage.find(row => row.key === "prizeOptIn")?.answeredProjects !== value.prizes.answeredProjects
		)
			fail("Inconsistent project answer coverage");
	});

export type ProjectInsights = z.infer<typeof projectInsightsSchema>;
