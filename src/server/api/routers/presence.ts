import { RoleName, type PrismaClient } from "@prisma/client";
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
		select: { name: true, roles: { select: { name: true } } },
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
				action: "scan",
				sourceId: presenceId,
				sourceType: "Presence",
				author: organizer.name ?? "Unknown",
				route: "presence.scan",
				details: `Scanned participant ${input.hackerId} for event ${input.eventId} (${result.workflow})`,
			});
			return result;
		} catch (error) {
			return scannerError(error);
		}
	}),

	adjust: protectedProcedure
		.input(scannerInput.extend({ amount: z.union([z.literal(-1), z.literal(1)]) }))
		.mutation(async ({ ctx, input }) => {
			const organizer = await requireScannerOrganizer(ctx);
			try {
				const { id: presenceId, ...result } = await adjustPresenceForEvent(
					createPrismaScannerRepository(ctx.prisma),
					input.eventId,
					input.hackerId,
					input.amount,
				);
				await log(ctx, {
					action: "adjust",
					sourceId: presenceId,
					sourceType: "Presence",
					author: organizer.name ?? "Unknown",
					route: "presence.adjust",
					details: `Adjusted participant ${input.hackerId} for event ${input.eventId} by ${input.amount}`,
				});
				return result;
			} catch (error) {
				return scannerError(error);
			}
		}),
});
