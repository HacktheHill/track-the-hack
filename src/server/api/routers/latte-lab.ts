import {
	LatteCancellationReason,
	LatteDrink,
	LatteFlavour,
	LatteIngredient,
	LatteMilkBase,
	LatteOrderStatus,
	LatteSweetener,
	LatteTemperature,
	Prisma,
	type PrismaClient,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createAuditEvent, emitAuditEvent, persistAuditEvent } from "@/server/lib/audit-event";
import { log } from "@/server/lib/log";
import {
	ACTIVE_LATTE_STATUSES,
	allergensForConfiguration,
	availableRecipe,
	configurationError,
} from "@/server/services/latte-lab";
import { createTRPCRouter, organizerProcedure, participantProcedure } from "@/server/api/trpc";

const idempotencyKey = z
	.string()
	.min(16)
	.max(128)
	.regex(/^[A-Za-z0-9_-]+$/);
const configuration = z
	.object({
		drink: z.nativeEnum(LatteDrink),
		temperature: z.nativeEnum(LatteTemperature),
		milkBase: z.nativeEnum(LatteMilkBase),
		flavour: z.nativeEnum(LatteFlavour),
		sweetener: z.nativeEnum(LatteSweetener),
	})
	.strict();
const orderSelection = {
	id: true,
	pickupName: true,
	drink: true,
	temperature: true,
	milkBase: true,
	flavour: true,
	sweetener: true,
	status: true,
	submittedAt: true,
	preparingAt: true,
	readyAt: true,
	completedAt: true,
	cancelledAt: true,
	cancellationReason: true,
} satisfies Prisma.LatteOrderSelect;

const currentAvailability = async (prisma: PrismaClient | Prisma.TransactionClient) =>
	new Set(
		(
			await prisma.latteIngredientAvailability.findMany({
				where: { available: true },
				select: { ingredient: true },
			})
		).map(row => row.ingredient),
	);

const participantOrder = async (prisma: PrismaClient, hackerId: string) => {
	const order =
		(await prisma.latteOrder.findFirst({
			where: { hackerId, status: { in: ACTIVE_LATTE_STATUSES } },
			select: orderSelection,
			orderBy: { submittedAt: "desc" },
		})) ??
		(await prisma.latteOrder.findFirst({
			where: { hackerId },
			select: orderSelection,
			orderBy: { submittedAt: "desc" },
		}));
	if (!order) return null;
	const position =
		order.status === LatteOrderStatus.QUEUED
			? (await prisma.latteOrder.count({
					where: { status: LatteOrderStatus.QUEUED, submittedAt: { lt: order.submittedAt } },
				})) + 1
			: null;
	return { ...order, position, allergens: allergensForConfiguration(order) };
};

export const latteLabRouter = createTRPCRouter({
	menu: participantProcedure.query(async ({ ctx }) => {
		const [state, available] = await Promise.all([
			ctx.prisma.latteLabState.findUnique({ where: { id: 1 } }),
			currentAvailability(ctx.prisma),
		]);
		return {
			open: state?.open ?? false,
			drinks: Object.values(LatteDrink).map(drink => availableRecipe(drink, available)),
		};
	}),
	activeOrder: participantProcedure.query(({ ctx }) => participantOrder(ctx.prisma, ctx.participantSession.hackerId)),
	placeOrder: participantProcedure
		.input(configuration.extend({ pickupName: z.string().trim().min(1).max(40), submissionKey: idempotencyKey }))
		.mutation(async ({ ctx, input }) => {
			const hackerId = ctx.participantSession.hackerId;
			const existing = await ctx.prisma.latteOrder.findUnique({
				where: { submissionKey: input.submissionKey },
				select: { hackerId: true, ...orderSelection },
			});
			if (existing) {
				if (existing.hackerId !== hackerId) throw new TRPCError({ code: "CONFLICT" });
				return {
					...existing,
					position:
						existing.status === LatteOrderStatus.QUEUED
							? (await ctx.prisma.latteOrder.count({
									where: {
										status: LatteOrderStatus.QUEUED,
										submittedAt: { lt: existing.submittedAt },
									},
								})) + 1
							: null,
					allergens: allergensForConfiguration(existing),
				};
			}
			try {
				const auditEvent = await ctx.prisma.$transaction(
					async tx => {
						const state = await tx.latteLabState.findUnique({ where: { id: 1 } });
						if (!state?.open)
							throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Latte Lab is closed" });
						const error = configurationError(input, await currentAvailability(tx));
						if (error) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error });
						const order = await tx.latteOrder.create({
							data: { ...input, hackerId, activeHackerId: hackerId },
							select: { id: true },
						});
						const auditEvent = createAuditEvent({
							name: "latte.order.placed",
							outcome: "queued",
							actor: { type: "participant", id: hackerId },
							subject: { type: "hacker", id: hackerId },
							resource: { type: "latte_order", id: order.id },
							data: {
								drink: input.drink,
								temperature: input.temperature,
								milkBase: input.milkBase,
								flavour: input.flavour,
								sweetener: input.sweetener,
							},
						});
						await persistAuditEvent(tx, auditEvent);
						return auditEvent;
					},
					{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
				);
				emitAuditEvent(auditEvent);
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
					const retry = await ctx.prisma.latteOrder.findUnique({
						where: { submissionKey: input.submissionKey },
						select: { hackerId: true },
					});
					if (!retry || retry.hackerId !== hackerId)
						throw new TRPCError({ code: "CONFLICT", message: "An active order already exists" });
				} else throw error;
			}
			return participantOrder(ctx.prisma, hackerId);
		}),
	cancelQueuedOrder: participantProcedure
		.input(z.object({ orderId: z.string().min(1) }).strict())
		.mutation(async ({ ctx, input }) => {
			const order = await ctx.prisma.latteOrder.findFirst({
				where: { id: input.orderId, hackerId: ctx.participantSession.hackerId },
				select: { status: true },
			});
			if (!order) throw new TRPCError({ code: "NOT_FOUND" });
			if (order.status === LatteOrderStatus.CANCELLED) return null;
			if (order.status !== LatteOrderStatus.QUEUED)
				throw new TRPCError({ code: "CONFLICT", message: "Only queued orders can be cancelled" });
			const auditEvent = await ctx.prisma.$transaction(async tx => {
				const updated = await tx.latteOrder.updateMany({
					where: {
						id: input.orderId,
						hackerId: ctx.participantSession.hackerId,
						status: LatteOrderStatus.QUEUED,
					},
					data: {
						status: LatteOrderStatus.CANCELLED,
						activeHackerId: null,
						pickupName: null,
						cancelledAt: new Date(),
						cancellationReason: LatteCancellationReason.PARTICIPANT_CANCELLED,
					},
				});
				if (updated.count !== 1) throw new TRPCError({ code: "CONFLICT", message: "Order state changed" });
				const auditEvent = createAuditEvent({
					name: "latte.order.cancelled",
					outcome: "cancelled",
					actor: { type: "participant", id: ctx.participantSession.hackerId },
					subject: { type: "hacker", id: ctx.participantSession.hackerId },
					resource: { type: "latte_order", id: input.orderId },
					data: { reason: LatteCancellationReason.PARTICIPANT_CANCELLED },
				});
				await persistAuditEvent(tx, auditEvent);
				return auditEvent;
			});
			emitAuditEvent(auditEvent);
			return null;
		}),
	queue: organizerProcedure.query(async ({ ctx }) => {
		const [state, ingredients, orders] = await Promise.all([
			ctx.prisma.latteLabState.findUnique({ where: { id: 1 } }),
			ctx.prisma.latteIngredientAvailability.findMany({ orderBy: { ingredient: "asc" } }),
			ctx.prisma.latteOrder.findMany({
				where: { status: { in: ACTIVE_LATTE_STATUSES } },
				select: { ...orderSelection, hackerId: true },
				orderBy: { submittedAt: "asc" },
			}),
		]);
		return {
			open: state?.open ?? false,
			ingredients,
			orders: orders.map(order => ({ ...order, allergens: allergensForConfiguration(order) })),
		};
	}),
	setOpen: organizerProcedure.input(z.object({ open: z.boolean() }).strict()).mutation(async ({ ctx, input }) => {
		const organizer = ctx.organizer;
		const { result, auditEvent } = await ctx.prisma.$transaction(async tx => {
			const result = await tx.latteLabState.upsert({
				where: { id: 1 },
				create: { id: 1, open: input.open, updatedByOrganizerId: organizer.id },
				update: { open: input.open, updatedByOrganizerId: organizer.id },
				select: { open: true, updatedAt: true },
			});
			const auditEvent = createAuditEvent({
				name: "latte.lab.open_changed",
				outcome: input.open ? "opened" : "closed",
				actor: { type: "organizer", id: organizer.id },
				data: { open: input.open },
			});
			await persistAuditEvent(tx, auditEvent);
			return { result, auditEvent };
		});
		emitAuditEvent(auditEvent);
		return result;
	}),
	setIngredientAvailability: organizerProcedure
		.input(z.object({ ingredient: z.nativeEnum(LatteIngredient), available: z.boolean() }).strict())
		.mutation(async ({ ctx, input }) => {
			const organizer = ctx.organizer;
			const { result, auditEvent } = await ctx.prisma.$transaction(async tx => {
				const result = await tx.latteIngredientAvailability.upsert({
					where: { ingredient: input.ingredient },
					create: { ...input, updatedByOrganizerId: organizer.id },
					update: { available: input.available, updatedByOrganizerId: organizer.id },
				});
				const auditEvent = createAuditEvent({
					name: "latte.ingredient.availability_changed",
					outcome: input.available ? "available" : "unavailable",
					actor: { type: "organizer", id: organizer.id },
					data: { ingredient: input.ingredient, available: input.available },
				});
				await persistAuditEvent(tx, auditEvent);
				return { result, auditEvent };
			});
			emitAuditEvent(auditEvent);
			return result;
		}),
	transitionOrder: organizerProcedure
		.input(
			z
				.object({
					orderId: z.string().min(1),
					expectedStatus: z.nativeEnum(LatteOrderStatus),
					nextStatus: z.nativeEnum(LatteOrderStatus),
					requestKey: idempotencyKey,
					reason: z.nativeEnum(LatteCancellationReason).optional(),
				})
				.strict(),
		)
		.mutation(async ({ ctx, input }) => {
			const organizer = ctx.organizer;
			const previous = await ctx.prisma.latteOrderTransition.findUnique({
				where: { requestKey: input.requestKey },
				select: { order: { select: orderSelection } },
			});
			if (previous) return previous.order;
			const allowed =
				input.nextStatus === LatteOrderStatus.CANCELLED
					? ACTIVE_LATTE_STATUSES.some(status => status === input.expectedStatus)
					: (input.expectedStatus === LatteOrderStatus.QUEUED &&
							input.nextStatus === LatteOrderStatus.PREPARING) ||
						(input.expectedStatus === LatteOrderStatus.PREPARING &&
							input.nextStatus === LatteOrderStatus.READY) ||
						(input.expectedStatus === LatteOrderStatus.READY &&
							input.nextStatus === LatteOrderStatus.COMPLETED);
			if (!allowed || (input.nextStatus === LatteOrderStatus.CANCELLED && !input.reason))
				throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid state transition" });
			const now = new Date();
			const { order, auditEvent } = await ctx.prisma.$transaction(async tx => {
				const current = await tx.latteOrder.findUnique({
					where: { id: input.orderId },
					select: { hackerId: true },
				});
				if (!current) throw new TRPCError({ code: "NOT_FOUND" });
				const updated = await tx.latteOrder.updateMany({
					where: { id: input.orderId, status: input.expectedStatus },
					data: {
						status: input.nextStatus,
						handledByOrganizerId: organizer.id,
						...(input.nextStatus === LatteOrderStatus.PREPARING ? { preparingAt: now } : {}),
						...(input.nextStatus === LatteOrderStatus.READY ? { readyAt: now } : {}),
						...(input.nextStatus === LatteOrderStatus.COMPLETED
							? { completedAt: now, activeHackerId: null, pickupName: null }
							: {}),
						...(input.nextStatus === LatteOrderStatus.CANCELLED
							? {
									cancelledAt: now,
									activeHackerId: null,
									pickupName: null,
									cancellationReason: input.reason,
								}
							: {}),
					},
				});
				if (updated.count !== 1) throw new TRPCError({ code: "CONFLICT", message: "Order state changed" });
				await tx.latteOrderTransition.create({
					data: {
						orderId: input.orderId,
						requestKey: input.requestKey,
						fromStatus: input.expectedStatus,
						toStatus: input.nextStatus,
						organizerId: organizer.id,
					},
				});
				const order = await tx.latteOrder.findUniqueOrThrow({
					where: { id: input.orderId },
					select: orderSelection,
				});
				const auditEvent = createAuditEvent({
					name: "latte.order.transitioned",
					outcome: input.nextStatus.toLowerCase(),
					actor: { type: "organizer", id: organizer.id },
					subject: { type: "hacker", id: current.hackerId },
					resource: { type: "latte_order", id: input.orderId },
					data: {
						fromStatus: input.expectedStatus,
						toStatus: input.nextStatus,
						reason: input.reason ?? null,
					},
				});
				await persistAuditEvent(tx, auditEvent);
				return { order, auditEvent };
			});
			await log(ctx, {
				sourceId: order.id,
				sourceType: "LatteOrder",
				author: organizer.name ?? "Unknown",
				userId: organizer.id,
				route: "latteLab.transitionOrder",
				action: input.nextStatus.toLowerCase(),
				details: `Transitioned Latte order ${order.id} to ${input.nextStatus}`,
			});
			emitAuditEvent(auditEvent);
			return order;
		}),
});
