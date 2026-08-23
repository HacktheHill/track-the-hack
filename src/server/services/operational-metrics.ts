import { ScannerWorkflow, type PrismaClient } from "@prisma/client";

type MetricsDatabase = Pick<PrismaClient, "event" | "hacker" | "presence">;

export const getOperationalMetrics = async (prisma: MetricsDatabase) => {
	const [
		provisioned,
		confirmed,
		walkIn,
		checkedIn,
		presenceTotal,
		attendanceByEvent,
		mealCategoryData,
		tShirtSizeData,
	] = await Promise.all([
		prisma.hacker.count(),
		prisma.hacker.count({ where: { confirmed: true } }),
		prisma.hacker.count({ where: { walkIn: true } }),
		prisma.presence.count({
			where: { event: { scannerWorkflow: ScannerWorkflow.CHECK_IN }, value: { gt: 0 } },
		}),
		prisma.presence.aggregate({ _sum: { value: true } }),
		prisma.presence.groupBy({ by: ["eventId"], _sum: { value: true } }),
		prisma.hacker.groupBy({ by: ["mealCategory"], _count: { mealCategory: true } }),
		prisma.hacker.groupBy({ by: ["tShirtSize"], _count: { tShirtSize: true } }),
	]);
	const events = await prisma.event.findMany({
		where: { id: { in: attendanceByEvent.map(({ eventId }) => eventId) } },
		select: { id: true, name: true },
	});
	const eventNames = new Map(events.map(({ id, name }) => [id, name]));
	const attendanceData = attendanceByEvent.flatMap(({ eventId, ...attendance }) => {
		const label = eventNames.get(eventId);
		return label === undefined ? [] : [{ eventId, label, ...attendance }];
	});

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
