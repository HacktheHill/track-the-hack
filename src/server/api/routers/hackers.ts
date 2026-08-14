import { RoleName } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";
import { participantIdSchema } from "../../services/hacker-lifecycle";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const hackerRouter = createTRPCRouter({
	get: protectedProcedure.input(z.object({ id: participantIdSchema })).query(async ({ ctx, input }) => {
		const organizer = await ctx.prisma.user.findUnique({
			where: { id: ctx.session.user.id },
			select: { roles: { select: { name: true } } },
		});
		if (!organizer || !hasRoles(organizer, [RoleName.ORGANIZER, RoleName.ADMIN])) {
			throw new TRPCError({ code: "FORBIDDEN" });
		}

		const hacker = await ctx.prisma.hacker.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				tShirtSize: true,
				mealCategory: true,
				confirmed: true,
				walkIn: true,
				acceptanceExpiry: true,
				teamId: true,
			},
		});
		if (!hacker) throw new TRPCError({ code: "NOT_FOUND", message: "Participant not found" });
		return hacker;
	}),
});
