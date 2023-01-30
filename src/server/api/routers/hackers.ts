import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { AttendanceType, ShirtSize } from "@prisma/client";

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
    assign: protectedProcedure.input(z.object({
        id: z.string(),
        shirtSize: z.enum([ShirtSize.S, ShirtSize.M, ShirtSize.L, ShirtSize.XL]),
        attendanceType: z.enum([AttendanceType.IN_PERSON, AttendanceType.ONLINE]),
        userId: z.string()
    })).mutation(({ ctx, input }) => {
        return ctx.prisma.hackerInfo.update({
            where: {
                id: input.id,
            },
            data: {
                shirtSize: input.shirtSize,
                attendanceType: input.attendanceType,
                userId: input.userId,
            }
        });
    }),
});
