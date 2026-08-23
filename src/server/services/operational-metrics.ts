import { ScannerWorkflow, type PrismaClient } from "@prisma/client";

type MetricsDatabase = Pick<PrismaClient, "hacker" | "presence">;

export const getOperationalMetrics = async (prisma: MetricsDatabase) => {
	const [provisioned, confirmed, walkIn, checkedIn, presenceTotal, attendanceData, mealCategoryData, tShirtSizeData] =
		await Promise.all([
			prisma.hacker.count(),
			prisma.hacker.count({ where: { confirmed: true } }),
			prisma.hacker.count({ where: { walkIn: true } }),
			prisma.presence.count({
				where: { event: { scannerWorkflow: ScannerWorkflow.CHECK_IN }, value: { gt: 0 } },
			}),
			prisma.presence.aggregate({ _sum: { value: true } }),
			prisma.presence.groupBy({ by: ["label"], _sum: { value: true } }),
			prisma.hacker.groupBy({ by: ["mealCategory"], _count: { mealCategory: true } }),
			prisma.hacker.groupBy({ by: ["tShirtSize"], _count: { tShirtSize: true } }),
		]);

	return {
		provisioned,
		confirmed,
		walkIn,
		checkedIn,
		presences: presenceTotal._sum.value ?? 0,
		attendanceData,
		mealCategoryData,
		tShirtSizeData,
	};
};
