import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { participantIdSchema } from "@/server/services/hacker-lifecycle";
import { createTRPCRouter, organizerProcedure } from "@/server/api/trpc";

export const hackerRouter = createTRPCRouter({
	get: organizerProcedure.input(z.object({ id: participantIdSchema })).query(async ({ ctx, input }) => {
		const hacker = await ctx.prisma.hacker.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				tShirtSize: true,
				mealCategory: true,
				confirmed: true,
				walkIn: true,
				acceptanceExpiry: true,
			},
		});
		if (!hacker) throw new TRPCError({ code: "NOT_FOUND", message: "Participant not found" });
		return hacker;
	}),
});
