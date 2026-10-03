import { z } from "zod";
const count = z.number().int().nonnegative();
export const normalizationSchema = z
	.array(
		z
			.object({
				key: z.enum(["school", "areaOfStudy", "studyLevel"]),
				answered: count,
				recognized: count,
				unmapped: count,
				sourceCategories: count,
				normalizedCategories: count,
				mergedVariants: count,
			})
			.strict(),
	)
	.length(3)
	.superRefine((rows, ctx) => {
		if (
			new Set(rows.map(row => row.key)).size !== 3 ||
			rows.some(
				row =>
					row.recognized + row.unmapped !== row.answered ||
					row.sourceCategories > row.answered ||
					row.normalizedCategories > row.sourceCategories ||
					row.mergedVariants !== row.sourceCategories - row.normalizedCategories,
			)
		)
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inconsistent normalization summary" });
	});
