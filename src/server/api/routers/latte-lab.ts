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
	RoleName,
	type PrismaClient,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasRoles } from "@/utils/helpers";
import { log } from "@/server/lib/log";
import {
	ACTIVE_LATTE_STATUSES,
	allergensForConfiguration,
	availableRecipe,
	configurationError,
} from "@/server/services/latte-lab";
import { createTRPCRouter, participantProcedure, protectedProcedure } from "@/server/api/trpc";

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

const requireOrganizer = async (prisma: PrismaClient, userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, roles: { select: { name: true } } },
	});
	if (!user || !hasRoles(user, [RoleName.ORGANIZER, RoleName.ADMIN])) throw new TRPCError({ code: "FORBIDDEN" });
	return user;
};

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
				await ctx.prisma.$transaction(
					async tx => {
						const state = await tx.latteLabState.findUnique({ where: { id: 1 } });
						if (!state?.open)
							throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Latte Lab is closed" });
						const error = configurationError(input, await currentAvailability(tx));
						if (error) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error });
						await tx.latteOrder.create({ data: { ...input, hackerId, activeHackerId: hackerId } });
					},
					{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
				);
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
			await ctx.prisma.latteOrder.update({
				where: { id: input.orderId },
				data: {
					status: LatteOrderStatus.CANCELLED,
					activeHackerId: null,
					pickupName: null,
					cancelledAt: new Date(),
					cancellationReason: LatteCancellationReason.PARTICIPANT_CANCELLED,
				},
			});
			return null;
		}),
	queue: protectedProcedure.query(async ({ ctx }) => {
		await requireOrganizer(ctx.prisma, ctx.session.user.id);
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
	setOpen: protectedProcedure.input(z.object({ open: z.boolean() }).strict()).mutation(async ({ ctx, input }) => {
		const organizer = await requireOrganizer(ctx.prisma, ctx.session.user.id);
		return ctx.prisma.latteLabState.upsert({
			where: { id: 1 },
			create: { id: 1, open: input.open, updatedByOrganizerId: organizer.id },
			update: { open: input.open, updatedByOrganizerId: organizer.id },
			select: { open: true, updatedAt: true },
		});
	}),
	setIngredientAvailability: protectedProcedure
		.input(z.object({ ingredient: z.nativeEnum(LatteIngredient), available: z.boolean() }).strict())
		.mutation(async ({ ctx, input }) => {
			const organizer = await requireOrganizer(ctx.prisma, ctx.session.user.id);
			return ctx.prisma.latteIngredientAvailability.upsert({
				where: { ingredient: input.ingredient },
				create: { ...input, updatedByOrganizerId: organizer.id },
				update: { available: input.available, updatedByOrganizerId: organizer.id },
			});
		}),
	transitionOrder: protectedProcedure
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
			const organizer = await requireOrganizer(ctx.prisma, ctx.session.user.id);
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
			const order = await ctx.prisma.$transaction(async tx => {
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
				return tx.latteOrder.findUniqueOrThrow({ where: { id: input.orderId }, select: orderSelection });
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
			return order;
		}),
});
