import { RoleName } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasRoles } from "@/utils/helpers";
import { createTRPCRouter, protectedProcedure, publicProcedure, participantProcedure } from "@/server/api/trpc";

export const eventsRouter = createTRPCRouter({
	getInterest: participantProcedure.input(z.object({ eventId: z.string().min(1) })).query(async ({ ctx, input }) => {
		const interest = await ctx.prisma.eventInterest.findUnique({
			where: { hackerId_eventId: { hackerId: ctx.participantSession.hackerId, eventId: input.eventId } },
		});
		return interest !== null;
	}),
	setInterest: participantProcedure
		.input(z.object({ eventId: z.string().min(1), interested: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const event = await ctx.prisma.event.findUnique({
				where: { id: input.eventId },
				select: { id: true, hidden: true },
			});
			if (!event || event.hidden) throw new TRPCError({ code: "NOT_FOUND" });
			const selection = { hackerId: ctx.participantSession.hackerId, eventId: event.id };
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

	// The scanner gets only its server-owned action contract. Schedule content
	// and arbitrary participant fields do not need to cross this boundary.
	scannable: protectedProcedure.query(async ({ ctx }) => {
		const organizer = await ctx.prisma.user.findUnique({
			where: { id: ctx.session.user.id },
			select: { roles: { select: { name: true } } },
		});
		if (!organizer || !hasRoles(organizer, [RoleName.ORGANIZER, RoleName.ADMIN])) {
			throw new TRPCError({ code: "FORBIDDEN" });
		}

		const gracePeriodMs = 30 * 60 * 1000;
		const cutoff = new Date(Date.now() - gracePeriodMs);
		return ctx.prisma.event.findMany({
			where: { end: { gt: cutoff } },
			select: {
				id: true,
				name: true,
				nameFr: true,
				scannerWorkflow: true,
			},
			orderBy: { start: "asc" },
		});
	}),
});
