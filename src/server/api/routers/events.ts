import { RoleName } from "@prisma/client";
import { hasRoles } from "../../../utils/helpers";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const eventInputSchema = z.object({
	name: z.string().min(1),
	nameFr: z.string().min(1),
	room: z.string().min(1),
	start: z.date(),
	end: z.date(),
	description: z.string(),
	descriptionFr: z.string(),
	hidden: z.boolean(),

	image: z.string().nullable().optional(),
	link: z.string().nullable().optional(),
	linkText: z.string().nullable().optional(),
});

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

	// Create event
	create: protectedProcedure.input(eventInputSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;

		const user = await ctx.prisma.user.findUnique({
			where: {
				id: userId,
			},
			select: {
				name: true,
				roles: {
					select: {
						name: true,
					},
				},
			},
		});

		if (!user) {
			throw new Error("User not found");
		}

		if (!hasRoles(user, [RoleName.ORGANIZER, RoleName.ADMIN])) {
			throw new Error("You do not have permission to create events");
		}

		if (input.end <= input.start) {
			throw new Error("Event end time must be after start time");
		}

		return ctx.prisma.event.create({
			data: {
				name: input.name,
				nameFr: input.nameFr,
				room: input.room,
				start: input.start,
				end: input.end,
				description: input.description,
				descriptionFr: input.descriptionFr,
				hidden: input.hidden,
				image: input.image ?? null,
				link: input.link ?? null,
				linkText: input.linkText ?? null,
			},
		});
	}),
	// Update event
	update: protectedProcedure
		.input(
			eventInputSchema.extend({
				id: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					name: true,
					roles: {
						select: {
							name: true,
						},
					},
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [RoleName.ORGANIZER, RoleName.ADMIN])) {
				throw new Error("You do not have permission to update events");
			}

			const existingEvent = await ctx.prisma.event.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!existingEvent) {
				throw new Error("Event not found");
			}

			if (input.end <= input.start) {
				throw new Error("Event end time must be after start time");
			}

			return ctx.prisma.event.update({
				where: {
					id: input.id,
				},
				data: {
					name: input.name,
					nameFr: input.nameFr,
					room: input.room,
					start: input.start,
					end: input.end,
					description: input.description,
					descriptionFr: input.descriptionFr,
					hidden: input.hidden,
					image: input.image ?? null,
					link: input.link ?? null,
					linkText: input.linkText ?? null,
				},
			});
		}),
});
