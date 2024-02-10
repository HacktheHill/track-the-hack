import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";

export const eventsRouter = createTRPCRouter({
	// Get event
	get: publicProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const event = await ctx.prisma.event.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!event) {
				throw new Error("No event found");
			}

			return event;
		}),

	// Get all events
	all: publicProcedure.query(async ({ ctx }) => {
		const events = await ctx.prisma.event.findMany();

		if (!events) {
			throw new Error("No events found");
		}

		return events;
	}),

	checkHackers: publicProcedure
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.query(async ({ ctx, input }) => {
		const hackers = await ctx.prisma.event.findMany({
			where: {
				id: input.id,
			},
		});

		return hackers;
	}),
});