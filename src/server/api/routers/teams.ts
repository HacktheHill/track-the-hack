import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const teamsRouter = createTRPCRouter({
	// Check if a team exists
	check: protectedProcedure
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
			const hacker = await ctx.prisma.hacker.findUnique({
				where: {
					userId: ctx.session.user.id,
				},
			});

			if (!hacker || hacker.id !== input.hackerId) {
				throw new Error("You do not have permission to do this");
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
