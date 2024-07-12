import { Role } from "@prisma/client";
import { z } from "zod";
import { roles } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
	// Get the given user's role
	getRole: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: input.id,
				},
			});
			if (!user) {
				return null;
			}
			const role = roles.safeParse(user.role);
			if (role.success) {
				return role.data;
			}
			return null;
		}),

	// Get the given user's hacker id
	getHackerId: protectedProcedure
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

			const hacker = await ctx.prisma.hackerInfo.findFirst({
				where: {
					userId: input.id,
				},
			});

			if (!hacker) {
				return null;
			}

			if (!hasRoles(user, [Role.SPONSOR, Role.ORGANIZER]) && hacker.userId !== user.id) {
				throw new Error("You do not have permission to do this");
			}

			return hacker.id;
		}),

	// Sign up a new user
	signUp: publicProcedure
		.input(
			z.object({
				email: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingUser = await ctx.prisma.user.findFirst({
				where: {
					email: input.email,
				},
			});

			if (existingUser) {
				return existingUser;
			}

			const user = await ctx.prisma.user.create({
				data: {
					email: input.email,
				},
			});

			return user;
		}),
});
