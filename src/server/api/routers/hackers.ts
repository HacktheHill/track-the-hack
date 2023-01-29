import { z } from "zod";

import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";

export const hackerRouter = createTRPCRouter({
    // FIXME: This is not working because the query needs to fetch the hacker by userId instead of id
    get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const d = await ctx.prisma.hackerInfo.findUnique({
            where: {
                id: input.id,
            },
        });
        console.log(d);
        return d;
    }),
    getAll: publicProcedure.query(async ({ ctx }) => {
        return ctx.prisma.hackerInfo.findMany();
    }),
    delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
        return ctx.prisma.hackerInfo.delete({
            where: {
                id: input.id,
            },
        });
    }),
});
