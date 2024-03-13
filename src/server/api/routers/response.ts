import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const responseRouter = createTRPCRouter({
	// Get all questions related to an event
	create: protectedProcedure.input(
        z.object({
            questionId: z.string(),
            hackerId: z.string(),
            response: z.string(),
        }),
    ).mutation(async ({ ctx, input }) => {
        const response = await ctx.prisma.response.create({
            data: {
                questionId: input.questionId,
                hackerId: input.hackerId,
                response: input.response,
            },
        });

        return response;
    }),
    createMany: protectedProcedure.input(
        z.object({
            questionIdsToResponses: z.record(z.string(), z.string()),
            hackerInfoId: z.string(),
        }),
    ).mutation(async ({ ctx, input }) => {
        const responses = Object.entries(input.questionIdsToResponses).map(([questionId, response]) => {
            return {
                questionId,
                hackerInfoId: input.hackerInfoId,
                response,
            }
        })

        const createdResponses = await ctx.prisma.response.createMany({
            data: responses,
        });

        return createdResponses;
    }),
});