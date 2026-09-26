import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createAuditEvent, emitAuditEvent, persistAuditEvent } from "@/server/lib/audit-event";
import { getOrganizerAccess, hasOrganizerEmailDomain, normalizeOrganizerEmail } from "@/server/lib/organizer-auth";
import { adminProcedure, createTRPCRouter, organizerProcedure } from "@/server/api/trpc";

const emailSchema = z.string().trim().email().max(191).transform(normalizeOrganizerEmail);

export const userRouter = createTRPCRouter({
	getOrganizerPass: organizerProcedure
		.input(z.object({ id: z.string().min(1).max(191) }))
		.query(async ({ ctx, input }) => {
			const organizer = await getOrganizerAccess(ctx.prisma, input.id);
			if (!organizer) throw new TRPCError({ code: "NOT_FOUND", message: "Organiser not found" });
			return { id: organizer.id, name: organizer.name };
		}),

	listOrganizerAccess: adminProcedure.query(async ({ ctx }) =>
		ctx.prisma.organizerAccess.findMany({
			select: { id: true, email: true, createdAt: true, createdById: true },
			orderBy: [{ createdAt: "asc" }, { email: "asc" }],
		}),
	),

	addOrganizerAccess: adminProcedure.input(z.object({ email: emailSchema })).mutation(async ({ ctx, input }) => {
		if (hasOrganizerEmailDomain(input.email)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"CTN addresses cannot be added here; organiser accounts must use firstname.lastname@ctn-rtc.org",
			});
		}

		const { access, auditEvent } = await ctx.prisma.$transaction(
			async transaction => {
				const existing = await transaction.organizerAccess.findUnique({
					where: { email: input.email },
					select: { id: true, email: true, createdAt: true, createdById: true },
				});
				const access =
					existing ??
					(await transaction.organizerAccess.create({
						data: { email: input.email, createdById: ctx.organizer.id },
						select: { id: true, email: true, createdAt: true, createdById: true },
					}));
				const auditEvent = createAuditEvent({
					name: "organizer.access.added",
					outcome: existing ? "unchanged" : "added",
					actor: { type: "organizer", id: ctx.organizer.id },
					resource: { type: "organizer_access", id: access.id },
					data: {},
				});
				await persistAuditEvent(transaction, auditEvent);
				return { access, auditEvent };
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);
		emitAuditEvent(auditEvent);
		return access;
	}),

	removeOrganizerAccess: adminProcedure
		.input(z.object({ id: z.string().min(1).max(191) }))
		.mutation(async ({ ctx, input }) => {
			const { removed, auditEvent } = await ctx.prisma.$transaction(
				async transaction => {
					const removed = await transaction.organizerAccess.deleteMany({ where: { id: input.id } });
					const auditEvent = createAuditEvent({
						name: "organizer.access.removed",
						outcome: removed.count === 1 ? "removed" : "unchanged",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "organizer_access", id: input.id },
						data: {},
					});
					await persistAuditEvent(transaction, auditEvent);
					return { removed: removed.count === 1, auditEvent };
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			);
			emitAuditEvent(auditEvent);
			return { removed };
		}),
});
