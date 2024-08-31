import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const teamsRouter = createTRPCRouter({
	// Check if a team exists
	check: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Team name is required"),
			}),
		)
		.query(async ({ input }) => {
			const team = await prisma.team.findUnique({
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
	create: publicProcedure
		.input(
			z.object({
				teamName: z.string().min(3).max(50),
				hackerId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const existingTeam = await prisma.team.findUnique({
				where: {
					name: input.teamName,
				},
			});

			if (existingTeam) {
				throw new Error("Team already exists");
			}

			const newTeam = await prisma.team.create({
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

			await prisma.team.deleteMany({
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
