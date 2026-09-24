import { HardwareLoanStatus, Prisma, RoleName, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasRoles } from "@/utils/helpers";
import { log } from "@/server/lib/log";
import { participantIdSchema } from "@/server/services/hacker-lifecycle";
import { createTRPCRouter, participantProcedure, protectedProcedure } from "@/server/api/trpc";

const key = z
	.string()
	.min(16)
	.max(128)
	.regex(/^[A-Za-z0-9_-]+$/);
const cartLine = z.object({ itemId: z.string().min(1), quantity: z.number().int().positive().max(999) }).strict();
const returnLine = z
	.object({
		loanLineId: z.string().min(1),
		good: z.number().int().nonnegative(),
		damaged: z.number().int().nonnegative(),
		missing: z.number().int().nonnegative(),
	})
	.strict()
	.refine(value => value.good + value.damaged + value.missing > 0, "At least one item must be returned");

const requireOrganizer = async (prisma: PrismaClient, userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, roles: { select: { name: true } } },
	});
	if (!user || !hasRoles(user, [RoleName.ORGANIZER, RoleName.ADMIN])) throw new TRPCError({ code: "FORBIDDEN" });
	return user;
};

const catalogue = (prisma: PrismaClient) =>
	prisma.hardwareItem.findMany({
		where: { active: true },
		select: {
			id: true,
			importKey: true,
			category: true,
			name: true,
			description: true,
			imageURL: true,
			availableQuantity: true,
		},
		orderBy: [{ category: "asc" }, { name: "asc" }],
	});

const loanSelection = {
	id: true,
	hackerId: true,
	pickupName: true,
	status: true,
	checkedOutAt: true,
	idCollectedAt: true,
	lines: {
		select: {
			id: true,
			borrowedQuantity: true,
			goodQuantity: true,
			damagedQuantity: true,
			missingQuantity: true,
			item: { select: { id: true, name: true } },
		},
	},
} satisfies Prisma.HardwareLoanSelect;

export const hardwareRouter = createTRPCRouter({
	catalogue: participantProcedure.query(({ ctx }) => catalogue(ctx.prisma)),
	organizerCatalogue: protectedProcedure.query(async ({ ctx }) => {
		await requireOrganizer(ctx.prisma, ctx.session.user.id);
		return catalogue(ctx.prisma);
	}),
	checkout: protectedProcedure
		.input(
			z
				.object({
					hackerId: participantIdSchema,
					pickupName: z.string().trim().min(1).max(40),
					idCollected: z.literal(true),
					idempotencyKey: key,
					lines: z.array(cartLine).min(1).max(50),
				})
				.strict()
				.superRefine((value, context) => {
					if (new Set(value.lines.map(line => line.itemId)).size !== value.lines.length)
						context.addIssue({ code: "custom", message: "Duplicate cart item", path: ["lines"] });
				}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizer = await requireOrganizer(ctx.prisma, ctx.session.user.id);
			const existing = await ctx.prisma.hardwareLoan.findUnique({
				where: { checkoutKey: input.idempotencyKey },
				select: loanSelection,
			});
			if (existing) return existing;
			try {
				const loan = await ctx.prisma.$transaction(
					async tx => {
						const hacker = await tx.hacker.findUnique({
							where: { id: input.hackerId },
							select: { id: true },
						});
						if (!hacker) throw new TRPCError({ code: "NOT_FOUND", message: "Participant not found" });
						for (const line of input.lines) {
							const updated = await tx.hardwareItem.updateMany({
								where: { id: line.itemId, active: true, availableQuantity: { gte: line.quantity } },
								data: { availableQuantity: { decrement: line.quantity } },
							});
							if (updated.count !== 1) {
								const item = await tx.hardwareItem.findUnique({
									where: { id: line.itemId },
									select: { name: true, availableQuantity: true },
								});
								throw new TRPCError({
									code: "CONFLICT",
									message: item
										? `${item.name} has ${item.availableQuantity} available`
										: "Hardware item not found",
								});
							}
						}
						return tx.hardwareLoan.create({
							data: {
								hackerId: input.hackerId,
								pickupName: input.pickupName,
								checkoutOrganizerId: organizer.id,
								checkoutKey: input.idempotencyKey,
								idCollectedAt: new Date(),
								lines: {
									create: input.lines.map(line => ({
										itemId: line.itemId,
										borrowedQuantity: line.quantity,
									})),
								},
							},
							select: loanSelection,
						});
					},
					{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
				);
				await log(ctx, {
					sourceId: loan.id,
					sourceType: "HardwareLoan",
					author: organizer.name ?? "Unknown",
					userId: organizer.id,
					route: "hardware.checkout",
					action: "checkout",
					details: `Checked out hardware loan ${loan.id} to participant ${loan.hackerId}`,
				});
				return loan;
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
					const retried = await ctx.prisma.hardwareLoan.findUnique({
						where: { checkoutKey: input.idempotencyKey },
						select: loanSelection,
					});
					if (retried) return retried;
				}
				throw error;
			}
		}),
	activeLoans: protectedProcedure
		.input(
			z
				.object({ search: z.string().trim().max(40).optional() })
				.strict()
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			await requireOrganizer(ctx.prisma, ctx.session.user.id);
			return ctx.prisma.hardwareLoan.findMany({
				where: {
					status: HardwareLoanStatus.OPEN,
					...(input?.search ? { pickupName: { contains: input.search } } : {}),
				},
				select: loanSelection,
				orderBy: { checkedOutAt: "asc" },
				take: 100,
			});
		}),
	loanByParticipant: protectedProcedure
		.input(z.object({ hackerId: participantIdSchema }).strict())
		.query(async ({ ctx, input }) => {
			await requireOrganizer(ctx.prisma, ctx.session.user.id);
			return ctx.prisma.hardwareLoan.findFirst({
				where: { hackerId: input.hackerId, status: HardwareLoanStatus.OPEN },
				select: loanSelection,
				orderBy: { checkedOutAt: "desc" },
			});
		}),
	returnItems: protectedProcedure
		.input(
			z
				.object({
					loanId: z.string().min(1),
					idempotencyKey: key,
					idReturned: z.boolean(),
					lines: z.array(returnLine).min(1).max(50),
				})
				.strict()
				.superRefine((value, context) => {
					if (new Set(value.lines.map(line => line.loanLineId)).size !== value.lines.length)
						context.addIssue({ code: "custom", message: "Duplicate loan line", path: ["lines"] });
				}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizer = await requireOrganizer(ctx.prisma, ctx.session.user.id);
			const prior = await ctx.prisma.hardwareReturn.findUnique({
				where: { idempotencyKey: input.idempotencyKey },
				select: { loan: { select: loanSelection } },
			});
			if (prior) return prior.loan;
			const loan = await ctx.prisma
				.$transaction(
					async tx => {
						const current = await tx.hardwareLoan.findUnique({
							where: { id: input.loanId },
							include: { lines: true },
						});
						if (!current || current.status !== HardwareLoanStatus.OPEN)
							throw new TRPCError({ code: "CONFLICT", message: "Loan is not open" });
						const byId = new Map(current.lines.map(line => [line.id, line]));
						for (const returned of input.lines) {
							const line = byId.get(returned.loanLineId);
							if (!line) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown loan line" });
							const outstanding =
								line.borrowedQuantity - line.goodQuantity - line.damagedQuantity - line.missingQuantity;
							if (returned.good + returned.damaged + returned.missing > outstanding)
								throw new TRPCError({
									code: "BAD_REQUEST",
									message: "Return exceeds outstanding quantity",
								});
						}
						const hardwareReturn = await tx.hardwareReturn.create({
							data: {
								loanId: current.id,
								organizerId: organizer.id,
								idempotencyKey: input.idempotencyKey,
							},
						});
						for (const returned of input.lines) {
							const line = byId.get(returned.loanLineId);
							if (!line) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown loan line" });
							await tx.hardwareReturnLine.create({
								data: {
									returnId: hardwareReturn.id,
									loanLineId: line.id,
									goodQuantity: returned.good,
									damagedQuantity: returned.damaged,
									missingQuantity: returned.missing,
								},
							});
							await tx.hardwareLoanLine.update({
								where: { id: line.id },
								data: {
									goodQuantity: { increment: returned.good },
									damagedQuantity: { increment: returned.damaged },
									missingQuantity: { increment: returned.missing },
								},
							});
							await tx.hardwareItem.update({
								where: { id: line.itemId },
								data: {
									availableQuantity: { increment: returned.good },
									damagedQuantity: { increment: returned.damaged },
									missingQuantity: { increment: returned.missing },
								},
							});
						}
						const remaining = current.lines.reduce((sum, line) => {
							const returned = input.lines.find(value => value.loanLineId === line.id);
							return (
								sum +
								line.borrowedQuantity -
								line.goodQuantity -
								line.damagedQuantity -
								line.missingQuantity -
								(returned ? returned.good + returned.damaged + returned.missing : 0)
							);
						}, 0);
						if (remaining === 0) {
							const hasMissing = current.lines.some(
								line =>
									line.missingQuantity +
										(input.lines.find(value => value.loanLineId === line.id)?.missing ?? 0) >
									0,
							);
							await tx.hardwareLoan.update({
								where: { id: current.id },
								data: {
									status: hasMissing
										? HardwareLoanStatus.CLOSED_WITH_MISSING
										: HardwareLoanStatus.CLOSED,
									closedAt: new Date(),
									pickupName: null,
									...(input.idReturned ? { idReturnedAt: new Date() } : {}),
								},
							});
						}
						return tx.hardwareLoan.findUniqueOrThrow({ where: { id: current.id }, select: loanSelection });
					},
					{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
				)
				.catch(async error => {
					if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
						const retry = await ctx.prisma.hardwareReturn.findUnique({
							where: { idempotencyKey: input.idempotencyKey },
							select: { loan: { select: loanSelection } },
						});
						if (retry) return retry.loan;
					}
					throw error;
				});
			await log(ctx, {
				sourceId: loan.id,
				sourceType: "HardwareLoan",
				author: organizer.name ?? "Unknown",
				userId: organizer.id,
				route: "hardware.returnItems",
				action: "return",
				details: `Recorded hardware return for loan ${loan.id} and participant ${loan.hackerId}`,
			});
			return loan;
		}),
});
