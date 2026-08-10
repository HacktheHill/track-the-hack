import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { assignHackerToTeam } from "../../team-operations";

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
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const hacker = await ctx.prisma.hacker.findUnique({
				where: { userId: ctx.session.user.id },
				select: { id: true },
			});
			if (!hacker) throw new Error("Hacker not found");
			const team = await assignHackerToTeam({ prisma: ctx.prisma }, hacker.id, input.teamName);
			return {
				name: team.name,
				members: team.members.map(member => member.firstName),
			};
		}),
});
