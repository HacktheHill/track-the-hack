import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const responseRouter = createTRPCRouter({
	// Get all questions related to an event
	create: protectedProcedure.input(
        z.object({
            questionId: z.string(),
            hackerInfoId: z.string(),
            response: z.string(),
        }),
    ).query(async ({ ctx, input }) => {
        const response = await ctx.prisma.response.create({
            data: {
                questionId: input.questionId,
                hackerInfoId: input.hackerInfoId,
                response: input.response,
            },
        });

        return response;
    }),
});
