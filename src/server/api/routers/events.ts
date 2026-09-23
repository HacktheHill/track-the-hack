import { EventType, Prisma, RoleName, ScannerWorkflow } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { httpsUrl } from "@/server/lib/event-validation";
import { hasRoles } from "@/utils/helpers";
import { createTRPCRouter, protectedProcedure, publicProcedure, participantProcedure } from "@/server/api/trpc";

const varchar = z.string().trim().min(1).max(191);
const text = z
	.string()
	.trim()
	.min(1)
	.max(65_535)
	.refine(value => Buffer.byteLength(value, "utf8") <= 65_535, "Text must not exceed 65,535 UTF-8 bytes");
const eventInputShape = {
	name: varchar,
	nameFr: varchar,
	room: varchar,
	start: z.date(),
	end: z.date(),
	description: text,
	descriptionFr: text,
	hidden: z.boolean(),
	type: z.nativeEnum(EventType),
	scannerWorkflow: z.nativeEnum(ScannerWorkflow),
	maxCheckIns: z.number().int().min(0).max(2_147_483_647).nullable(),
	host: varchar.nullable(),
	link: httpsUrl.nullable(),
	linkText: varchar.nullable(),
	linkTextFr: varchar.nullable(),
};

const validateEventInput = (input: z.infer<z.ZodObject<typeof eventInputShape>>, ctx: z.RefinementCtx) => {
	if (input.end <= input.start) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["end"],
			message: "Event end time must be after start time",
		});
	}

	const linkValues = [input.link, input.linkText, input.linkTextFr];
	if (linkValues.some(value => value === null) && linkValues.some(value => value !== null)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["link"],
			message: "Link URL and both localized labels must be provided together",
		});
	}
};

const eventInputSchema = z.object(eventInputShape).strict().superRefine(validateEventInput);
const eventUpdateInputSchema = z
	.object({ ...eventInputShape, id: varchar })
	.strict()
	.superRefine(validateEventInput);

const publicEventSelect = {
	id: true,
	name: true,
	nameFr: true,
	room: true,
	start: true,
	end: true,
	description: true,
	descriptionFr: true,
	type: true,
	host: true,
	image: true,
	link: true,
	linkText: true,
	linkTextFr: true,
} as const;

const managedEventSelect = {
	...publicEventSelect,
	hidden: true,
	scannerWorkflow: true,
	maxCheckIns: true,
} as const;

export const eventsRouter = createTRPCRouter({
	getInterest: participantProcedure.input(z.object({ eventId: z.string().min(1) })).query(async ({ ctx, input }) => {
		const interest = await ctx.prisma.eventInterest.findFirst({
			where: {
				hackerId: ctx.participantSession.hackerId,
				eventId: input.eventId,
				Event: { hidden: false },
			},
			select: { id: true },
		});
		return interest !== null;
	}),
	setInterest: participantProcedure
		.input(z.object({ eventId: z.string().min(1), interested: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.prisma.$transaction(
				async transaction => {
					const event = await transaction.event.findUnique({
						where: { id: input.eventId },
						select: { id: true, hidden: true },
					});
					if (!event || event.hidden) throw new TRPCError({ code: "NOT_FOUND" });
					const selection = { hackerId: ctx.participantSession.hackerId, eventId: event.id };
					if (input.interested) {
						await transaction.eventInterest.upsert({
							where: { hackerId_eventId: selection },
							create: selection,
							update: {},
						});
					} else {
						await transaction.eventInterest.deleteMany({ where: selection });
					}
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			);
			return input.interested;
		}),

	// Get event
	get: publicProcedure
		.input(
			z.object({
				id: varchar,
			}),
		)
		.query(async ({ ctx, input }) => {
			const event = await ctx.prisma.event.findFirst({
				where: { id: input.id, hidden: false },
				select: publicEventSelect,
			});

			if (!event) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
			}

			return event;
		}),

	// Get all events
	all: publicProcedure.query(async ({ ctx }) => {
		return ctx.prisma.event.findMany({ where: { hidden: false }, select: publicEventSelect });
	}),

	manage: protectedProcedure.query(async ({ ctx }) => {
		const organizer = await ctx.prisma.user.findUnique({
			where: { id: ctx.session.user.id },
			select: { roles: { select: { name: true } } },
		});
		if (!organizer || !hasRoles(organizer, [RoleName.ORGANIZER, RoleName.ADMIN])) {
			throw new TRPCError({ code: "FORBIDDEN" });
		}

		return ctx.prisma.event.findMany({ select: managedEventSelect, orderBy: { start: "asc" } });
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
			throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
		}

		if (!hasRoles(user, [RoleName.ORGANIZER, RoleName.ADMIN])) {
			throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to create events" });
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
				type: input.type,
				scannerWorkflow: input.scannerWorkflow,
				maxCheckIns: input.maxCheckIns,
				host: input.host,
				image: null,
				link: input.link,
				linkText: input.linkText,
				linkTextFr: input.linkTextFr,
			},
		});
	}),
	// Update event
	update: protectedProcedure.input(eventUpdateInputSchema).mutation(async ({ ctx, input }) => {
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
			throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
		}

		if (!hasRoles(user, [RoleName.ORGANIZER, RoleName.ADMIN])) {
			throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to update events" });
		}

		return ctx.prisma.$transaction(async transaction => {
			const [existingEvent] = await transaction.$queryRaw<
				Array<{ id: string; start: Date; hidden: boolean; now: Date }>
			>`
				SELECT id, start, hidden, UTC_TIMESTAMP(3) AS now FROM Event WHERE id = ${input.id} FOR UPDATE
			`;
			if (!existingEvent) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

			const reopenReminder =
				!input.hidden &&
				input.start > existingEvent.now &&
				(existingEvent.hidden || existingEvent.start.getTime() !== input.start.getTime());
			return transaction.event.update({
				where: { id: input.id },
				data: {
					name: input.name,
					nameFr: input.nameFr,
					room: input.room,
					start: input.start,
					end: input.end,
					description: input.description,
					descriptionFr: input.descriptionFr,
					hidden: input.hidden,
					type: input.type,
					scannerWorkflow: input.scannerWorkflow,
					maxCheckIns: input.maxCheckIns,
					host: input.host,
					link: input.link,
					linkText: input.linkText,
					linkTextFr: input.linkTextFr,
					...(input.hidden ? { notifiedAt: existingEvent.now } : reopenReminder ? { notifiedAt: null } : {}),
				},
			});
		});
	}),
});
