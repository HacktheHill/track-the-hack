import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";

export const eventsRouter = createTRPCRouter({
	// Get an events
	get: publicProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const events = await ctx.prisma.event.findMany({
				where: {
					id: input.id,
				},
			});

			if (!events) {
				throw new Error("No events found");
			}

			return events;
		}),

	// Get all events
	all: publicProcedure.query(async ({ ctx }) => {
		const events = await ctx.prisma.event.findMany();

		if (!events) {
			throw new Error("No events found");
		}

		return events;
	}),
});
