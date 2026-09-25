import { HardwareInventoryMode, HardwareLoanStatus, Prisma, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createAuditEvent, emitAuditEvent, persistAuditEvent } from "@/server/lib/audit-event";
import { log } from "@/server/lib/log";
import { participantIdSchema } from "@/server/services/hacker-lifecycle";
import {
	hardwareReturnError,
	isHardwareAvailable,
	outstandingHardwareQuantity,
	resolvedHardwareQuantity,
} from "@/server/services/hardware-inventory";
import { createTRPCRouter, organizerProcedure, participantProcedure } from "@/server/api/trpc";

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
		consumed: z.number().int().nonnegative().default(0),
	})
	.strict()
	.refine(value => resolvedHardwareQuantity(value) > 0, "At least one item must be resolved");

const catalogue = async (prisma: PrismaClient) => {
	const items = await prisma.hardwareItem.findMany({
		where: { active: true },
		select: {
			id: true,
			importKey: true,
			category: true,
			owner: true,
			name: true,
			description: true,
			imageURL: true,
			inventoryMode: true,
			availableQuantity: true,
			availableForCheckout: true,
			consumptionAllowed: true,
			updatedAt: true,
		},
		orderBy: [{ category: "asc" }, { name: "asc" }],
	});
	return items.map(item => ({
		...item,
		isAvailable: isHardwareAvailable(item),
	}));
};

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
			consumedQuantity: true,
			item: {
				select: {
					id: true,
					name: true,
					inventoryMode: true,
					consumptionAllowed: true,
				},
			},
		},
	},
} satisfies Prisma.HardwareLoanSelect;

export const hardwareRouter = createTRPCRouter({
	catalogue: participantProcedure.query(async ({ ctx }) => {
		const items = await catalogue(ctx.prisma);
		return items.map(item => ({
			id: item.id,
			category: item.category,
			owner: item.owner,
			name: item.name,
			description: item.description,
			imageURL: item.imageURL,
			inventoryMode: item.inventoryMode,
			availableQuantity: item.availableQuantity,
			isAvailable: item.isAvailable,
			availableForCheckout: item.availableForCheckout,
		}));
	}),
	organizerCatalogue: organizerProcedure.query(({ ctx }) => catalogue(ctx.prisma)),
	setUncountedAvailability: organizerProcedure
		.input(
			z
				.object({
					itemId: z.string().min(1),
					available: z.boolean(),
					expectedUpdatedAt: z.date(),
				})
				.strict(),
		)
		.mutation(async ({ ctx, input }) => {
			const organizer = ctx.organizer;
			const { item, auditEvent } = await ctx.prisma.$transaction(
				async tx => {
					const current = await tx.hardwareItem.findUnique({ where: { id: input.itemId } });
					if (!current || !current.active) throw new TRPCError({ code: "NOT_FOUND" });
					if (current.inventoryMode !== HardwareInventoryMode.UNCOUNTED)
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Only uncounted hardware has manual availability",
						});
					if (current.availableForCheckout === input.available) return { item: current, auditEvent: null };
					const updated = await tx.hardwareItem.updateMany({
						where: { id: current.id, updatedAt: input.expectedUpdatedAt },
						data: { availableForCheckout: input.available },
					});
					if (updated.count !== 1)
						throw new TRPCError({ code: "CONFLICT", message: "Hardware availability changed" });
					const item = await tx.hardwareItem.findUniqueOrThrow({ where: { id: current.id } });
					const auditEvent = createAuditEvent({
						name: "hardware.item.availability_changed",
						outcome: input.available ? "available" : "out_of_stock",
						actor: { type: "organizer", id: organizer.id },
						resource: { type: "hardware_item", id: current.id },
						data: { previousAvailable: current.availableForCheckout, available: input.available },
					});
					await persistAuditEvent(tx, auditEvent);
					return { item, auditEvent };
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			);
			if (auditEvent) {
				emitAuditEvent(auditEvent);
				await log(ctx, {
					sourceId: item.id,
					sourceType: "HardwareItem",
					author: organizer.name ?? "Unknown",
					userId: organizer.id,
					route: "hardware.setUncountedAvailability",
					action: input.available ? "available" : "out_of_stock",
					details: `Changed availability for hardware item ${item.id}`,
				});
			}
			return item;
		}),
	checkout: organizerProcedure
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
			const organizer = ctx.organizer;
			const existing = await ctx.prisma.hardwareLoan.findUnique({
				where: { checkoutKey: input.idempotencyKey },
				select: loanSelection,
			});
			if (existing) return existing;
			try {
				const { loan, auditEvent } = await ctx.prisma.$transaction(
					async tx => {
						const hacker = await tx.hacker.findUnique({
							where: { id: input.hackerId },
							select: { id: true },
						});
						if (!hacker) throw new TRPCError({ code: "NOT_FOUND", message: "Participant not found" });
						for (const line of input.lines) {
							const item = await tx.hardwareItem.findUnique({ where: { id: line.itemId } });
							const updated = item
								? await tx.hardwareItem.updateMany({
										where:
											item.inventoryMode === HardwareInventoryMode.COUNTED
												? {
														id: line.itemId,
														active: true,
														availableForCheckout: true,
														inventoryMode: HardwareInventoryMode.COUNTED,
														availableQuantity: { gte: line.quantity },
													}
												: {
														id: line.itemId,
														active: true,
														availableForCheckout: true,
														inventoryMode: HardwareInventoryMode.UNCOUNTED,
													},
										data:
											item.inventoryMode === HardwareInventoryMode.COUNTED
												? { availableQuantity: { decrement: line.quantity } }
												: { availableForCheckout: true },
									})
								: { count: 0 };
							if (updated.count !== 1) {
								const current = await tx.hardwareItem.findUnique({
									where: { id: line.itemId },
									select: { name: true, inventoryMode: true, availableQuantity: true },
								});
								throw new TRPCError({
									code: "CONFLICT",
									message: current
										? current.inventoryMode === HardwareInventoryMode.COUNTED
											? `${current.name} has ${current.availableQuantity ?? 0} available`
											: `${current.name} is out of stock`
										: "Hardware item not found",
								});
							}
						}
						const loan = await tx.hardwareLoan.create({
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
						const auditEvent = createAuditEvent({
							name: "hardware.loan.checked_out",
							outcome: "recorded",
							actor: { type: "organizer", id: organizer.id },
							subject: { type: "hacker", id: input.hackerId },
							resource: { type: "hardware_loan", id: loan.id },
							data: {
								lineCount: input.lines.length,
								unitCount: input.lines.reduce((sum, line) => sum + line.quantity, 0),
								idCollected: true,
							},
						});
						await persistAuditEvent(tx, auditEvent);
						return { loan, auditEvent };
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
				emitAuditEvent(auditEvent);
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
	activeLoans: organizerProcedure
		.input(
			z
				.object({ search: z.string().trim().max(40).optional() })
				.strict()
				.optional(),
		)
		.query(({ ctx, input }) =>
			ctx.prisma.hardwareLoan.findMany({
				where: {
					status: HardwareLoanStatus.OPEN,
					...(input?.search ? { pickupName: { contains: input.search } } : {}),
				},
				select: loanSelection,
				orderBy: { checkedOutAt: "asc" },
				take: 100,
			}),
		),
	loanByParticipant: organizerProcedure
		.input(z.object({ hackerId: participantIdSchema }).strict())
		.query(({ ctx, input }) =>
			ctx.prisma.hardwareLoan.findFirst({
				where: { hackerId: input.hackerId, status: HardwareLoanStatus.OPEN },
				select: loanSelection,
				orderBy: { checkedOutAt: "desc" },
			}),
		),
	returnItems: organizerProcedure
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
			const organizer = ctx.organizer;
			const prior = await ctx.prisma.hardwareReturn.findUnique({
				where: { idempotencyKey: input.idempotencyKey },
				select: { loan: { select: loanSelection } },
			});
			if (prior) return prior.loan;
			const { loan, auditEvent } = await ctx.prisma
				.$transaction(
					async tx => {
						const current = await tx.hardwareLoan.findUnique({
							where: { id: input.loanId },
							include: { lines: { include: { item: true } } },
						});
						if (!current || current.status !== HardwareLoanStatus.OPEN)
							throw new TRPCError({ code: "CONFLICT", message: "Loan is not open" });
						const byId = new Map(current.lines.map(line => [line.id, line]));
						for (const returned of input.lines) {
							const line = byId.get(returned.loanLineId);
							if (!line) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown loan line" });
							const error = hardwareReturnError(
								{ ...line, consumptionAllowed: line.item.consumptionAllowed },
								returned,
							);
							if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
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
									consumedQuantity: returned.consumed,
								},
							});
							await tx.hardwareLoanLine.update({
								where: { id: line.id },
								data: {
									goodQuantity: { increment: returned.good },
									damagedQuantity: { increment: returned.damaged },
									missingQuantity: { increment: returned.missing },
									consumedQuantity: { increment: returned.consumed },
								},
							});
							if (line.item.inventoryMode === HardwareInventoryMode.COUNTED)
								await tx.hardwareItem.update({
									where: { id: line.itemId },
									data: {
										availableQuantity: { increment: returned.good },
										damagedQuantity: { increment: returned.damaged },
										missingQuantity: { increment: returned.missing },
										consumedQuantity: { increment: returned.consumed },
									},
								});
						}
						const remaining = current.lines.reduce((sum, line) => {
							const returned = input.lines.find(value => value.loanLineId === line.id);
							return (
								sum +
								outstandingHardwareQuantity(line) -
								(returned ? resolvedHardwareQuantity(returned) : 0)
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
						const loan = await tx.hardwareLoan.findUniqueOrThrow({
							where: { id: current.id },
							select: loanSelection,
						});
						const auditEvent = createAuditEvent({
							name: "hardware.loan.returned",
							outcome:
								loan.status === HardwareLoanStatus.OPEN
									? "partial"
									: loan.status === HardwareLoanStatus.CLOSED_WITH_MISSING
										? "closed_with_missing"
										: "closed",
							actor: { type: "organizer", id: organizer.id },
							subject: { type: "hacker", id: loan.hackerId },
							resource: { type: "hardware_loan", id: loan.id },
							data: {
								lineCount: input.lines.length,
								goodUnits: input.lines.reduce((sum, line) => sum + line.good, 0),
								damagedUnits: input.lines.reduce((sum, line) => sum + line.damaged, 0),
								missingUnits: input.lines.reduce((sum, line) => sum + line.missing, 0),
								consumedUnits: input.lines.reduce((sum, line) => sum + line.consumed, 0),
								idReturned: input.idReturned,
							},
						});
						await persistAuditEvent(tx, auditEvent);
						return { loan, auditEvent };
					},
					{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
				)
				.catch(async error => {
					if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
						const retry = await ctx.prisma.hardwareReturn.findUnique({
							where: { idempotencyKey: input.idempotencyKey },
							select: { loan: { select: loanSelection } },
						});
						if (retry) return { loan: retry.loan, auditEvent: null };
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
			if (auditEvent) emitAuditEvent(auditEvent);
			return loan;
		}),
});
