import { z } from "zod";

const nonNegativeInteger = z.number().int().nonnegative();

export const metricCohortSchema = z
	.object({
		applicants: nonNegativeInteger,
		accepted: nonNegativeInteger,
		confirmed: nonNegativeInteger,
		attended: nonNegativeInteger,
	})
	.strict();

export const metricBreakdownSchema = z
	.object({
		label: z.string().trim().min(1).max(120),
		...metricCohortSchema.shape,
	})
	.strict();

export const sheetMetricsSnapshotSchema = z
	.object({
		kind: z.literal("google-sheets"),
		rows: nonNegativeInteger,
		linkedRows: nonNegativeInteger,
		cohorts: metricCohortSchema,
		dimensions: z.record(z.string().regex(/^[a-z][A-Za-z0-9]{0,39}$/), z.array(metricBreakdownSchema).max(100)),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.linkedRows > value.rows) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["linkedRows"],
				message: "Linked rows cannot exceed rows.",
			});
		}
		if (value.cohorts.accepted > value.cohorts.applicants)
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["cohorts", "accepted"],
				message: "Accepted cannot exceed applicants.",
			});
		if (value.cohorts.confirmed > value.cohorts.accepted)
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["cohorts", "confirmed"],
				message: "Confirmed cannot exceed accepted.",
			});
		if (value.cohorts.attended > value.cohorts.accepted)
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["cohorts", "attended"],
				message: "Attended cannot exceed accepted.",
			});
	});

export const communicationsMetricsSnapshotSchema = z
	.object({
		kind: z.literal("communications"),
		acceptanceEmailsSesAccepted: nonNegativeInteger,
		acceptanceUniqueRecipients: nonNegativeInteger.optional(),
		bounceOrComplaintCount: nonNegativeInteger.optional(),
	})
	.strict();

export const devpostMetricsSnapshotSchema = z
	.object({
		kind: z.literal("devpost"),
		registrants: nonNegativeInteger,
		activeRegistrants: nonNegativeInteger,
		submitters: nonNegativeInteger,
		submittedProjects: nonNegativeInteger,
		publicProjects: nonNegativeInteger,
		hiddenProjects: nonNegativeInteger,
		draftProjects: nonNegativeInteger,
		teamUpRequests: nonNegativeInteger,
		linkage: z
			.object({
				applicationRows: nonNegativeInteger,
				uniqueApplicationEmails: nonNegativeInteger,
				duplicateApplicationRows: nonNegativeInteger,
				matchedRegistrants: nonNegativeInteger,
				matchedAccepted: nonNegativeInteger,
				matchedConfirmed: nonNegativeInteger,
				matchedAttended: nonNegativeInteger.optional(),
				matchedSubmitters: nonNegativeInteger,
				matchedAcceptedSubmitters: nonNegativeInteger,
				matchedConfirmedSubmitters: nonNegativeInteger,
				matchedAttendedSubmitters: nonNegativeInteger.optional(),
				unmatchedRegistrants: nonNegativeInteger,
			})
			.strict(),
	})
	.strict()
	.superRefine((value, context) => {
		const invalid = (path: Array<string | number>, message: string) =>
			context.addIssue({ code: z.ZodIssueCode.custom, path, message });
		if (value.activeRegistrants > value.registrants)
			invalid(["activeRegistrants"], "Active registrants cannot exceed registrants.");
		if (value.submitters > value.registrants) invalid(["submitters"], "Submitters cannot exceed registrants.");
		if (value.publicProjects + value.hiddenProjects > value.submittedProjects)
			invalid(["publicProjects"], "Visible and hidden projects cannot exceed submitted projects.");
		if (value.linkage.uniqueApplicationEmails > value.linkage.applicationRows)
			invalid(["linkage", "uniqueApplicationEmails"], "Unique application emails cannot exceed rows.");
		if (value.linkage.matchedRegistrants > value.registrants)
			invalid(["linkage", "matchedRegistrants"], "Matched registrants cannot exceed registrants.");
		if (value.linkage.matchedSubmitters > value.submitters)
			invalid(["linkage", "matchedSubmitters"], "Matched submitters cannot exceed submitters.");
		if (value.linkage.matchedAccepted > value.linkage.matchedRegistrants)
			invalid(["linkage", "matchedAccepted"], "Matched accepted cannot exceed matched registrants.");
		if (value.linkage.matchedConfirmed > value.linkage.matchedAccepted)
			invalid(["linkage", "matchedConfirmed"], "Matched confirmed cannot exceed matched accepted.");
		if (
			value.linkage.matchedAttended !== undefined &&
			value.linkage.matchedAttended > value.linkage.matchedAccepted
		)
			invalid(["linkage", "matchedAttended"], "Matched attended cannot exceed matched accepted.");
		if (value.linkage.matchedAcceptedSubmitters > value.linkage.matchedSubmitters)
			invalid(
				["linkage", "matchedAcceptedSubmitters"],
				"Matched accepted submitters cannot exceed matched submitters.",
			);
		if (value.linkage.matchedConfirmedSubmitters > value.linkage.matchedAcceptedSubmitters)
			invalid(
				["linkage", "matchedConfirmedSubmitters"],
				"Matched confirmed submitters cannot exceed matched accepted submitters.",
			);
	});

export const metricsSnapshotInputSchema = z.discriminatedUnion("source", [
	z
		.object({
			source: z.literal("google-sheets"),
			capturedAt: z.string().datetime(),
			payload: sheetMetricsSnapshotSchema,
		})
		.strict(),
	z
		.object({
			source: z.literal("communications"),
			capturedAt: z.string().datetime(),
			payload: communicationsMetricsSnapshotSchema,
		})
		.strict(),
	z
		.object({
			source: z.literal("devpost"),
			capturedAt: z.string().datetime(),
			payload: devpostMetricsSnapshotSchema,
		})
		.strict(),
]);

export type SheetMetricsSnapshot = z.infer<typeof sheetMetricsSnapshotSchema>;
export type CommunicationsMetricsSnapshot = z.infer<typeof communicationsMetricsSnapshotSchema>;
export type DevpostMetricsSnapshot = z.infer<typeof devpostMetricsSnapshotSchema>;

export type ParsedMetricsSnapshots = {
	sheet: { capturedAt: Date; payload: SheetMetricsSnapshot } | null;
	communications: { capturedAt: Date; payload: CommunicationsMetricsSnapshot } | null;
	devpost: { capturedAt: Date; payload: DevpostMetricsSnapshot } | null;
};

export const parseMetricsSnapshots = (
	rows: Array<{ source: string; payload: unknown; capturedAt: Date }>,
): ParsedMetricsSnapshots => {
	let sheet: ParsedMetricsSnapshots["sheet"] = null;
	let communications: ParsedMetricsSnapshots["communications"] = null;
	let devpost: ParsedMetricsSnapshots["devpost"] = null;
	for (const row of rows) {
		if (row.source === "google-sheets") {
			const payload = sheetMetricsSnapshotSchema.safeParse(row.payload);
			if (payload.success) sheet = { capturedAt: row.capturedAt, payload: payload.data };
		}
		if (row.source === "communications") {
			const payload = communicationsMetricsSnapshotSchema.safeParse(row.payload);
			if (payload.success) communications = { capturedAt: row.capturedAt, payload: payload.data };
		}
		if (row.source === "devpost") {
			const payload = devpostMetricsSnapshotSchema.safeParse(row.payload);
			if (payload.success) devpost = { capturedAt: row.capturedAt, payload: payload.data };
		}
	}
	return { sheet, communications, devpost };
};
