import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

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

	// Get all future events
	future: publicProcedure.query(async ({ ctx }) => {
		const events = await ctx.prisma.event.findMany({
			where: {
				start: {
					gt: new Date(),
				},
			},
		});

		if (!events) {
			throw new Error("No events found");
		}

		return events;
	}),
});
