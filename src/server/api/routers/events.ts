import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const eventsRouter = createTRPCRouter({
	getInterest: protectedProcedure.input(z.object({ eventId: z.string() })).query(async ({ ctx, input }) => {
		const hacker = await ctx.prisma.hacker.findUnique({
			where: { userId: ctx.session.user.id },
			select: { id: true },
		});
		if (!hacker) return false;
		const interest = await ctx.prisma.eventInterest.findUnique({
			where: { hackerId_eventId: { hackerId: hacker.id, eventId: input.eventId } },
		});
		return interest !== null;
	}),

	setInterest: protectedProcedure
		.input(z.object({ eventId: z.string(), interested: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const hacker = await ctx.prisma.hacker.findUnique({
				where: { userId: ctx.session.user.id },
				select: { id: true },
			});
			if (!hacker) throw new TRPCError({ code: "FORBIDDEN" });
			const event = await ctx.prisma.event.findUnique({ where: { id: input.eventId } });
			if (!event || event.hidden) throw new TRPCError({ code: "NOT_FOUND" });
			const selection = { hackerId: hacker.id, eventId: event.id };
			if (input.interested) {
				await ctx.prisma.eventInterest.upsert({
					where: { hackerId_eventId: selection },
					create: selection,
					update: {},
				});
			} else {
				await ctx.prisma.eventInterest.deleteMany({ where: selection });
			}
			return input.interested;
		}),

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
