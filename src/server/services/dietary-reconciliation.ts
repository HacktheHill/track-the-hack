import { MealCategory } from "@prisma/client";
import { z } from "zod";
import { participantIdSchema } from "@/server/services/hacker-lifecycle";

export const dietaryReconciliationSchema = z.object({
	participants: z.array(z.object({
		id: participantIdSchema,
		mealCategory: z.nativeEnum(MealCategory),
	}).strict()).min(1).max(500),
}).strict().superRefine(({ participants }, context) => {
	const seen = new Set<string>();
	participants.forEach(({ id }, index) => {
		if (seen.has(id)) context.addIssue({ code: "custom", message: "Duplicate participant ID", path: ["participants", index, "id"] });
		seen.add(id);
	});
});

export type DietaryUpdate = z.infer<typeof dietaryReconciliationSchema>["participants"][number];

export interface DietaryReconciliationRepository {
	updateExistingMealCategories(participants: DietaryUpdate[]): Promise<{ missingIds: string[] }>;
}

export const reconcileDietaryCategories = async (repository: DietaryReconciliationRepository, input: unknown) => {
	const { participants } = dietaryReconciliationSchema.parse(input);
	const result = await repository.updateExistingMealCategories(participants);
	return { processed: result.missingIds.length ? 0 : participants.length, missingIds: result.missingIds };
};
