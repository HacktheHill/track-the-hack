import { RoleName } from "@prisma/client";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { roles } from "../../../utils/common";

export const userRouter = createTRPCRouter({
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

	// Search for users by email or name
	search: protectedProcedure
		.input(
			z.object({
				query: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return ctx.prisma.user.findMany({
				where: {
					OR: [
						{
							email: {
								contains: input.query,
							},
						},
						{
							name: {
								contains: input.query,
							},
						},
					],
				},
				select: {
					id: true,
					name: true,
					email: true,
					image: true,
					roles: {
						select: {
							name: true,
						},
					},
				},
			});
		}),

	// Update user roles
	updateRoles: protectedProcedure
		.input(
			z.object({
				roles: z.array(roles),
				userIds: z.array(z.string()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					name: true,
					roles: {
						select: {
							name: true,
						},
					},
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [RoleName.ADMIN])) {
				throw new Error("You do not have permission to do this");
			}

			const transaction = [];

			for (const userId of input.userIds) {
				const user = await ctx.prisma.user.findUnique({
					where: {
						id: userId,
					},
					select: {
						id: true,
						roles: {
							select: {
								name: true,
							},
						},
					},
				});

				if (!user) {
					throw new Error("User not found");
				}

				transaction.push(
					ctx.prisma.user.update({
						where: {
							id: userId,
						},
						data: {
							roles: {
								set: input.roles.map((role: RoleName) => ({
									name: role,
								})),
							},
						},
					}),
				);
			}

			await ctx.prisma.$transaction(transaction);
		}),
});
