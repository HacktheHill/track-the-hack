import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { RoleName } from "@prisma/client";
import { hasRoles } from "../../../utils/helpers";

export const teamsRouter = createTRPCRouter({
	// Check if a team exists
	check: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Team name is required"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const team = await ctx.prisma.team.findUnique({
				where: {
					name: input.name,
				},
				include: {
					hackers: true,
				},
			});

			if (team) {
				return {
					exists: true as const,
					team: {
						name: team.name,
						members: team.hackers.map(hacker => hacker.firstName),
					},
				};
			} else {
				return {
					exists: false as const,
					team: null,
				};
			}
		}),

	// Create a new team
	create: protectedProcedure
		.input(
			z.object({
				teamName: z.string().min(3).max(50),
				hackerId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					roles: {
						select: {
							name: true,
						},
					},
					Hacker: true,
				},
			});

			if (!user) {
				throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
			}

			const isAuthorized = hasRoles(user, [RoleName.ADMIN, RoleName.ORGANIZER]) || (user.Hacker && user.Hacker.id === input.hackerId);

			if (!isAuthorized) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You are not authorized to create a team for this hacker.",
				});
			}

			const existingTeam = await ctx.prisma.team.findUnique({
				where: {
					name: input.teamName,
				},
			});

			if (existingTeam) {
				throw new Error("Team already exists");
			}

			const newTeam = await ctx.prisma.team.create({
				data: {
					name: input.teamName,
					hackers: {
						connect: {
							id: input.hackerId,
						},
					},
				},
				select: {
					name: true,
					hackers: {
						select: {
							firstName: true,
						},
					},
				},
			});

			await ctx.prisma.team.deleteMany({
				where: {
					hackers: {
						none: {},
					},
				},
			});

			return {
				name: newTeam.name,
				members: newTeam.hackers.map(hacker => hacker.firstName),
			};
		}),
});
