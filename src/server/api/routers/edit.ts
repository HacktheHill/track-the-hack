// userRouter.js
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const editRouter = createTRPCRouter({
    getById: protectedProcedure
        .input(
            z.object({
                id: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: {
                    id: input.id,
                },
            });

            if (!user) {
                throw new Error("User not found");
            }

            return user;
        }),

    updateHackerInfo: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                hackerInfo: z.object({
                    // Fields you want to update here
                        firstName: z.string(),
                        lastName: z.string(),
                        gender: z.string(),
                        university: z.string(),
                }),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const user = await ctx.prisma.user.findUnique({
                where: {
                    id: userId,
                },
            });

            if (!user) {
                throw new Error("User not found");
            }

            const updatedHackerInfo = await ctx.prisma.hackerInfo.update({
                where: {
                    id: input.id,
                },
                data: input.hackerInfo,
            });

            return updatedHackerInfo;
        }),
});
