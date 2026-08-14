import { RoleName } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const ORGANIZER_COUNT = 59;
const MENTOR_COUNT = 7;
const SPONSOR_COUNT = 23;
const GUEST_COUNT = 4;

export const metricsRouter = createTRPCRouter({
	getMetrics: protectedProcedure.query(async ({ ctx }) => {
		const organizer = await ctx.prisma.user.findUnique({
			where: { id: ctx.session.user.id },
			select: { roles: { select: { name: true } } },
		});
		if (!organizer || !hasRoles(organizer, [RoleName.ORGANIZER, RoleName.ADMIN, RoleName.PREMIER])) {
			throw new TRPCError({ code: "FORBIDDEN" });
		}

		const [
			provisioned,
			confirmed,
			walkIn,
			checkedIn,
			presenceRows,
			attendanceData,
			mealCategoryData,
			tShirtSizeData,
		] = await Promise.all([
			ctx.prisma.hacker.count(),
			ctx.prisma.hacker.count({ where: { confirmed: true } }),
			ctx.prisma.hacker.count({ where: { walkIn: true } }),
			ctx.prisma.presence.count({ where: { label: "Check-In" } }),
			ctx.prisma.presence.findMany({ select: { value: true } }),
			ctx.prisma.presence.groupBy({ by: ["label"], _sum: { value: true } }),
			ctx.prisma.hacker.groupBy({ by: ["mealCategory"], _count: { mealCategory: true } }),
			ctx.prisma.hacker.groupBy({ by: ["tShirtSize"], _count: { tShirtSize: true } }),
		]);

		return {
			provisioned,
			confirmed,
			walkIn,
			checkedIn,
			presences: presenceRows.reduce((sum, presence) => sum + presence.value, 0),
			attendees: confirmed + walkIn + ORGANIZER_COUNT + MENTOR_COUNT + SPONSOR_COUNT + GUEST_COUNT,
			attendanceData,
			mealCategoryData,
			tShirtSizeData,
		};
	}),
});
