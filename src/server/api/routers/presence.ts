import { RoleName, ScannerWorkflow, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { hasRoles } from "@/utils/helpers";
import { log } from "@/server/lib/log";
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
			const { id: presenceId, ...result } = await scanParticipantForEvent(
				createPrismaScannerRepository(ctx.prisma),
				input.eventId,
				input.hackerId,
			);
			await log(ctx, {
				action: result.recordedNow ? "scan" : "scan_duplicate",
				sourceId: presenceId,
				sourceType: "Presence",
				author: organizer.name ?? "Unknown",
				userId: organizer.id,
				route: "presence.scan",
				details: result.recordedNow
					? `Recorded participant ${input.hackerId} for event ${input.eventId} (${result.workflow})`
					: `Participant ${input.hackerId} was already recorded for event ${input.eventId} (${result.workflow})`,
			});
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
				const { id: presenceId, ...result } = await adjustPresenceForEvent(
					createPrismaScannerRepository(ctx.prisma),
					input.eventId,
					input.hackerId,
					input.amount,
					input.expectedValue,
				);
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
				return result;
			} catch (error) {
				return scannerError(error);
			}
		}),
});
