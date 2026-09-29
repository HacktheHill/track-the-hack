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
			context.addIssue({ code: z.ZodIssueCode.custom, path: ["linkedRows"], message: "Linked rows cannot exceed rows." });
		}
		if (value.cohorts.accepted > value.cohorts.applicants)
			context.addIssue({ code: z.ZodIssueCode.custom, path: ["cohorts", "accepted"], message: "Accepted cannot exceed applicants." });
		if (value.cohorts.confirmed > value.cohorts.accepted)
			context.addIssue({ code: z.ZodIssueCode.custom, path: ["cohorts", "confirmed"], message: "Confirmed cannot exceed accepted." });
		if (value.cohorts.attended > value.cohorts.accepted)
			context.addIssue({ code: z.ZodIssueCode.custom, path: ["cohorts", "attended"], message: "Attended cannot exceed accepted." });
	});

export const communicationsMetricsSnapshotSchema = z
	.object({
		kind: z.literal("communications"),
		acceptanceEmailsSesAccepted: nonNegativeInteger,
		acceptanceUniqueRecipients: nonNegativeInteger.optional(),
		bounceOrComplaintCount: nonNegativeInteger.optional(),
	})
	.strict();

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
]);

export type SheetMetricsSnapshot = z.infer<typeof sheetMetricsSnapshotSchema>;
export type CommunicationsMetricsSnapshot = z.infer<typeof communicationsMetricsSnapshotSchema>;

export type ParsedMetricsSnapshots = {
	sheet: { capturedAt: Date; payload: SheetMetricsSnapshot } | null;
	communications: { capturedAt: Date; payload: CommunicationsMetricsSnapshot } | null;
};

export const parseMetricsSnapshots = (
	rows: Array<{ source: string; payload: unknown; capturedAt: Date }>,
): ParsedMetricsSnapshots => {
	let sheet: ParsedMetricsSnapshots["sheet"] = null;
	let communications: ParsedMetricsSnapshots["communications"] = null;
	for (const row of rows) {
		if (row.source === "google-sheets") {
			const payload = sheetMetricsSnapshotSchema.safeParse(row.payload);
			if (payload.success) sheet = { capturedAt: row.capturedAt, payload: payload.data };
		}
		if (row.source === "communications") {
			const payload = communicationsMetricsSnapshotSchema.safeParse(row.payload);
			if (payload.success) communications = { capturedAt: row.capturedAt, payload: payload.data };
		}
	}
	return { sheet, communications };
};
