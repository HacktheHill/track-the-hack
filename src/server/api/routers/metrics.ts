import { RoleName } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { hasRoles } from "@/utils/helpers";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getOperationalMetrics } from "@/server/services/operational-metrics";

export const metricsRouter = createTRPCRouter({
	getMetrics: protectedProcedure.query(async ({ ctx }) => {
		const organizer = await ctx.prisma.user.findUnique({
			where: { id: ctx.session.user.id },
			select: { roles: { select: { name: true } } },
		});
		if (!organizer || !hasRoles(organizer, [RoleName.ORGANIZER, RoleName.ADMIN, RoleName.PREMIER])) {
			throw new TRPCError({ code: "FORBIDDEN" });
		}

		return getOperationalMetrics(ctx.prisma);
	}),
});
