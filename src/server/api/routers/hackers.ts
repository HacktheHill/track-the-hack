import { AttendanceType, ShirtSize } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const hackerRouter = createTRPCRouter({
	get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
		return ctx.prisma.hackerInfo.findUnique({
			where: {
				id: input.id,
			},
		});
	}),
	assign: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				shirtSize: z.enum([ShirtSize.S, ShirtSize.M, ShirtSize.L, ShirtSize.XL, ShirtSize.XXL]),
				attendanceType: z.enum([AttendanceType.IN_PERSON, AttendanceType.ONLINE]),
				userId: z.string(),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.prisma.hackerInfo.update({
				where: {
					id: input.id,
				},
				data: {
					shirtSize: input.shirtSize,
					attendanceType: input.attendanceType,
					userId: input.userId,
					confirmed: true,
				},
			});
		}),
});
