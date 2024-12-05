import { RoleName } from "@prisma/client";
import argon2 from "argon2";
import { z } from "zod";
import { env } from "../../../env/server.mjs";
import { hasRoles } from "../../../utils/helpers";
import { log } from "../../lib/log";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { passwordSchema } from "../../../utils/common";

export const userRouter = createTRPCRouter({
	// Sign up a new user
	signUp: publicProcedure
		.input(
			z.object({
				email: z.string(),
				password: passwordSchema.optional(),
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

			const passwordHash = input.password ? await argon2.hash(input.password) : undefined;

			const user = await ctx.prisma.user.create({
				data: {
					email: input.email,
					passwordHash,
				},
			});

			await log(ctx, {
				sourceId: user.id,
				sourceType: "User",
				action: "SignUp",
				author: user.name ?? "Unknown",
				route: "/api/users/signUp",
				details: `User signed up with email ${user.email ?? "Unknown"}`,
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
				roles: z.array(z.nativeEnum(RoleName)),
				userIds: z.array(z.string()).optional(),
				bypass: z.boolean().optional().default(false)
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

			if (!hasRoles(user, [RoleName.ADMIN]) && !input.bypass) {
				throw new Error("You do not have permission to do this");
			}

			if (!input.userIds) {
				input.userIds = [userId]
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

			await log(ctx, {
				sourceId: userId,
				sourceType: "User",
				action: "update",
				author: user.name ?? "Unknown",
				route: "/internal/roles",
				details: `Updated roles for users ${input.userIds.join(", ")} to ${input.roles.join(", ")}`,
			});

			await ctx.prisma.$transaction(transaction);
		}),

	// Discord server verification
	verifyDiscord: protectedProcedure
		.input(
			z.object({
				discordId: z.string(),
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
					Hacker: true,
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [RoleName.HACKER]) || !user.Hacker) {
				throw new Error("You have not yet been accepted as a hacker");
			}

			const response = await fetch(`${env.DISCORD_BOT_URL}/verify`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					discordId: input.discordId,
					secretKey: env.DISCORD_BOT_SECRET_KEY,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to verify Discord ID");
			}

			await log(ctx, {
				sourceId: userId,
				sourceType: "User",
				action: "verifyDiscord",
				author: user.name ?? "Unknown",
				route: "/discord",
				details: `Discord ID ${input.discordId} verified as user ${userId} with bot`,
			});

			return true;
		}),

	// Check if user is a hacker
	isHacker: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const hacker = await ctx.prisma.hacker.findUnique({
			where: {
				userId,
			},
		});

		return !!hacker;
	}),
});
