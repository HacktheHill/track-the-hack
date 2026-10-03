import { z } from "zod";
import { normalizationFields } from "./normalization";
const count = z.number().int().nonnegative();
export const normalizationSchema = z
	.array(
		z
			.object({
				key: z.enum(normalizationFields),
				answered: count,
				recognized: count,
				unmapped: count,
				sourceCategories: count,
				normalizedCategories: count,
				mergedVariants: count,
			})
			.strict(),
	)
	.min(3)
	.max(normalizationFields.length)
	.superRefine((rows, ctx) => {
		if (
			new Set(rows.map(row => row.key)).size !== rows.length ||
			!["school", "areaOfStudy", "studyLevel"].every(key => rows.some(row => row.key === key)) ||
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
