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
	// Events an organizer can still scan for. An event stays selectable while it
	// is running and for 30 minutes after it ends, so late arrivals can still be
	// checked in. Filtering by start would hide an event the moment it begins,
	// which is exactly when the scanner is used.
	future: publicProcedure.query(async ({ ctx }) => {
		const gracePeriodMs = 30 * 60 * 1000;
		const cutoff = new Date(Date.now() - gracePeriodMs);

		return ctx.prisma.event.findMany({
			where: {
				end: {
					gt: cutoff,
				},
			},
			orderBy: {
				start: "asc",
			},
		});
	}),
});
