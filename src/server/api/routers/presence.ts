import { RoleName, ScannerWorkflow, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { hasRoles } from "@/utils/helpers";
import { log } from "@/server/lib/log";
import { createAuditEvent, emitAuditEvent, persistAuditEvent } from "@/server/lib/audit-event";
import { participantIdSchema } from "@/server/services/hacker-lifecycle";
import {
	adjustPresenceForEvent,
	createPrismaScannerRepository,
	scanParticipantForEvent,
	ScannerWorkflowError,
} from "@/server/services/scanner-workflows";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const scannerInput = z.object({
	eventId: z.string().min(1),
	hackerId: participantIdSchema,
});

const requireScannerOrganizer = async (ctx: { session: { user: { id: string } }; prisma: PrismaClient }) => {
	const organizer = await ctx.prisma.user.findUnique({
		where: { id: ctx.session.user.id },
		select: { id: true, name: true, roles: { select: { name: true } } },
	});
	if (!organizer || !hasRoles(organizer, [RoleName.ORGANIZER, RoleName.ADMIN])) {
		throw new TRPCError({ code: "FORBIDDEN" });
	}
	return organizer;
};

const scannerError = (error: unknown): never => {
	if (error instanceof ScannerWorkflowError) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message:
				error.reason === "EVENT_NOT_FOUND"
					? "Event not found"
					: error.reason === "PARTICIPANT_NOT_FOUND"
						? "Participant not found"
						: "Presence not found",
		});
	}
	throw error;
};

export const presenceRouter = createTRPCRouter({
	getEventInterests: protectedProcedure.input(scannerInput).query(async ({ ctx, input }) => {
		await requireScannerOrganizer(ctx);
		const event = await ctx.prisma.event.findUnique({
			where: { id: input.eventId },
			select: { scannerWorkflow: true },
		});
		if (!event || event.scannerWorkflow !== ScannerWorkflow.ATTENDANCE) throw new TRPCError({ code: "FORBIDDEN" });
		const interests = await ctx.prisma.eventInterest.findMany({
			where: { hackerId: input.hackerId, Event: { hidden: false } },
			select: { Event: { select: { id: true, name: true, nameFr: true, start: true } } },
			orderBy: { Event: { start: "asc" } },
		});
		return interests.map(interest => interest.Event);
	}),

	// A scan is keyed only by event and participant. The event owns the label,
	// workflow, field allowlist, and maximum; none are accepted from the client.
	scan: protectedProcedure.input(scannerInput).mutation(async ({ ctx, input }) => {
		const organizer = await requireScannerOrganizer(ctx);
		try {
			const { presenceId, result, auditEvent } = await ctx.prisma.$transaction(async transaction => {
				const { id: presenceId, ...result } = await scanParticipantForEvent(
					createPrismaScannerRepository(transaction),
					input.eventId,
					input.hackerId,
				);
				const outcome =
					result.outcome === "new"
						? "recorded"
						: result.outcome === "unchanged"
							? "duplicate"
							: result.outcome;
				const appliedDelta = result.outcome === "new" ? result.value : result.outcome === "incremented" ? 1 : 0;
				const auditEvent = createAuditEvent({
					name: "scanner.scan",
					outcome,
					actor: { type: "organizer", id: organizer.id },
					subject: { type: "hacker", id: input.hackerId },
					resource: { type: "event", id: input.eventId },
					data: {
						workflow: result.workflow,
						presenceId,
						beforeCount: result.value - appliedDelta,
						afterCount: result.value,
						requestedDelta: 1,
						appliedDelta,
					},
				});
				await persistAuditEvent(transaction, auditEvent);
				return { presenceId, result, auditEvent };
			});
			await log(ctx, {
				action:
					result.outcome === "new"
						? "scan"
						: result.outcome === "incremented"
							? "scan_incremented"
							: result.outcome === "limit"
								? "scan_limit"
								: "scan_duplicate",
				sourceId: presenceId,
				sourceType: "Presence",
				author: organizer.name ?? "Unknown",
				userId: organizer.id,
				route: "presence.scan",
				details:
					result.outcome === "new"
						? `Recorded participant ${input.hackerId} for event ${input.eventId} (${result.workflow})`
						: result.outcome === "incremented"
							? `Incremented participant ${input.hackerId} for event ${input.eventId} (${result.workflow}) to ${result.value}`
							: result.outcome === "limit"
								? `Participant ${input.hackerId} reached the limit for event ${input.eventId} (${result.workflow}) at ${result.value}`
								: `Participant ${input.hackerId} was already recorded for event ${input.eventId} (${result.workflow})`,
			});
			emitAuditEvent(auditEvent);
			return result;
		} catch (error) {
			return scannerError(error);
		}
	}),

	adjust: protectedProcedure
		.input(
			scannerInput.extend({
				amount: z.union([z.literal(-1), z.literal(1)]),
				expectedValue: z.number().int().nonnegative(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizer = await requireScannerOrganizer(ctx);
			try {
				const { presenceId, result, auditEvent } = await ctx.prisma.$transaction(async transaction => {
					const {
						id: presenceId,
						beforeValue,
						workflow,
						...result
					} = await adjustPresenceForEvent(
						createPrismaScannerRepository(transaction),
						input.eventId,
						input.hackerId,
						input.amount,
						input.expectedValue,
					);
					const auditEvent = createAuditEvent({
						name: "scanner.adjust",
						outcome: result.applied ? "applied" : result.stale ? "stale" : "out_of_bounds",
						actor: { type: "organizer", id: organizer.id },
						subject: { type: "hacker", id: input.hackerId },
						resource: { type: "event", id: input.eventId },
						data: {
							workflow,
							presenceId,
							beforeCount: result.applied ? beforeValue : result.value,
							afterCount: result.value,
							requestedDelta: input.amount,
							appliedDelta: result.applied ? input.amount : 0,
						},
					});
					await persistAuditEvent(transaction, auditEvent);
					return { presenceId, result, auditEvent };
				});
				await log(ctx, {
					action: result.applied ? "adjust" : result.stale ? "adjust_stale" : "adjust_noop",
					sourceId: presenceId,
					sourceType: "Presence",
					author: organizer.name ?? "Unknown",
					userId: organizer.id,
					route: "presence.adjust",
					details: result.applied
						? `Adjusted participant ${input.hackerId} for event ${input.eventId} by ${input.amount}`
						: result.stale
							? `Rejected stale adjustment for participant ${input.hackerId} at event ${input.eventId}; expected ${input.expectedValue}, current ${result.value}`
							: `Ignored out-of-bounds adjustment for participant ${input.hackerId} at event ${input.eventId}; current ${result.value}`,
				});
				emitAuditEvent(auditEvent);
				return result;
			} catch (error) {
				return scannerError(error);
			}
		}),
});
