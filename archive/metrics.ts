import { z } from "zod";

// Explicit public allowlist. Passing an internal dashboard response is an error.
export const publicMetricsSchema = z
	.object({
		asOf: z.string().date(),
		preliminary: z.boolean(),
		participants: z.number().int().nonnegative(),
		participantsAtLeast: z.boolean(),
		hackers: z.number().int().nonnegative(),
		organisers: z.number().int().nonnegative(),
		volunteers: z.number().int().nonnegative(),
		volunteersAtLeast: z.boolean(),
		projects: z.number().int().nonnegative(),
		workshops: z.number().int().nonnegative(),
	})
	.strict();

export type PublicMetrics = z.infer<typeof publicMetricsSchema>;
