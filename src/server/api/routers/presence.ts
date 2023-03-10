import { Role } from "@prisma/client";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const presenceRouter = createTRPCRouter({
	getFromHackerId: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [Role.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			const hacker = await ctx.prisma.hackerInfo.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			let presence = await ctx.prisma.presenceInfo.findUnique({
				where: {
					hackerInfoId: hacker.id,
				},
			});

			if (!presence) {
				presence = await ctx.prisma.presenceInfo.create({
					data: {
						hackerInfo: {
							connect: {
								id: hacker.id,
							},
						},
					},
				});
			}

			return presence;
		}),
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				presenceInfo: z.record(z.boolean()),
			}),
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

			if (!hasRoles(user, [Role.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			const hacker = await ctx.prisma.hackerInfo.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			await ctx.prisma.presenceInfo.upsert({
				where: {
					hackerInfoId: hacker.id,
				},
				update: input.presenceInfo,
				create: {
					...input.presenceInfo,
					hackerInfo: {
						connect: {
							id: hacker.id,
						},
					},
				},
			});
		}),
});
