import { AttendanceType, ShirtSize } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const hackerRouter = createTRPCRouter({
	get: publicProcedure
		.input(
			z
				.object({
					id: z.string(),
				})
				.or(z.object({ email: z.string() })),
		)
		.query(async ({ ctx, input }) => {
			if ("id" in input) {
				return ctx.prisma.hackerInfo.findUnique({
					where: {
						id: input.id,
					},
				});
			} else if ("email" in input) {
				return ctx.prisma.hackerInfo.findFirst({
					where: {
						email: input.email,
					},
				});
			}
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
		.mutation(async ({ ctx, input }) => {
			const hacker = await ctx.prisma.hackerInfo.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

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
	unsubscribe: publicProcedure
		.input(
			z.object({
				email: z.string(),
				unsubscribeToken: z.string().nullable(),
				unsubscribe: z.boolean().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const hacker = await ctx.prisma.hackerInfo.findFirst({
				where: {
					email: input.email,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			// If the hacker has an unsubscribe token and is not using it or is using it incorrectly
			if (
				hacker.unsubscribeToken !== null &&
				(input.unsubscribeToken === null || hacker.unsubscribeToken !== input.unsubscribeToken)
			) {
				throw new Error("invalid-unsubscribe-token");
			}

			return ctx.prisma.hackerInfo.updateMany({
				where: {
					email: input.email,
				},
				data: {
					unsubscribed: input.unsubscribe,
				},
			});
		}),
});
