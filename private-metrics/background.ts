import { z } from "zod";
const count = z.number().int().nonnegative();
export const participantBackgroundSchema = z
	.object({
		capturedAt: z.string().datetime(),
		ageStats: z
			.array(
				z
					.object({
						cohort: z.enum(["applicants", "accepted", "confirmed", "attended"]),
						answered: count,
						mean: z.number().min(10).max(100).nullable(),
						median: z.number().min(10).max(100).nullable(),
						stdDev: z.number().nonnegative().nullable().optional(),
						minimum: z.number().min(10).max(100).nullable().optional(),
						maximum: z.number().min(10).max(100).nullable().optional(),
						under22: z.number().int().nonnegative().optional(),
					})
					.strict(),
			)
			.length(4),
		accommodationResponses: count,
	})
	.strict()
	.superRefine((value, context) => {
		if (
			new Set(value.ageStats.map(row => row.cohort)).size !== 4 ||
			value.ageStats.some(
				row =>
					(row.under22 ?? 0) > row.answered ||
					(row.minimum != null && row.maximum != null && row.minimum > row.maximum) ||
					(row.answered < 5 &&
						(row.mean !== null ||
							row.median !== null ||
							row.stdDev != null ||
							row.minimum != null ||
							row.maximum != null)),
			)
		)
			context.addIssue({ code: z.ZodIssueCode.custom, message: "Inconsistent age summary or small cohort" });
	});
export type ParticipantBackground = z.infer<typeof participantBackgroundSchema>;
