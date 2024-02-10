import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const questionRouter = createTRPCRouter({
	// Get all questions related to an event
	all: protectedProcedure
    .input(
        z.object({
            eventId: z.string(),
        }),
    )
    .query(async ({ ctx, input }) => {
		const questions = await ctx.prisma.question.findMany({
            where: {
                eventId: input.eventId,
            },
        });

        return questions;

	}),
});