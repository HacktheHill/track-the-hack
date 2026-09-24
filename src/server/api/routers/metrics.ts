import { createTRPCRouter, organizerProcedure } from "@/server/api/trpc";
import { createPrismaOperationalMetricsRepository, getOperationalMetrics } from "@/server/services/operational-metrics";

export const metricsRouter = createTRPCRouter({
	getMetrics: organizerProcedure.query(async ({ ctx }) => {
		return getOperationalMetrics(createPrismaOperationalMetricsRepository(ctx.prisma));
	}),
});
