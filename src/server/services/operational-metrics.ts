import { ScannerWorkflow, type MealCategory, type PrismaClient, type TShirtSize } from "@prisma/client";

export type OperationalMetricsRepository = {
	countProvisioned(): Promise<number>;
	countConfirmed(): Promise<number>;
	countWalkIns(): Promise<number>;
	countCheckedIn(): Promise<number>;
	sumPresences(): Promise<number>;
	groupAttendanceByEvent(): Promise<Array<{ eventId: string; _sum: { value: number | null } }>>;
	groupMealCategories(): Promise<Array<{ mealCategory: MealCategory; _count: { mealCategory: number } }>>;
	groupTShirtSizes(): Promise<Array<{ tShirtSize: TShirtSize; _count: { tShirtSize: number } }>>;
	findEventNames(ids: string[]): Promise<Array<{ id: string; name: string }>>;
};

export const createPrismaOperationalMetricsRepository = (
	prisma: Pick<PrismaClient, "event" | "hacker" | "presence">,
): OperationalMetricsRepository => {
	// Keep Prisma's groupBy inference outside the contextual repository return
	// type; Prisma validates each query, and the repository exposes its result.
	const groupAttendanceByEvent = () => prisma.presence.groupBy({ by: ["eventId"], _sum: { value: true } });
	const countCheckedIn = () =>
		prisma.hacker.count({
			where: { presences: { some: { event: { scannerWorkflow: ScannerWorkflow.CHECK_IN }, value: { gt: 0 } } } },
		});
	const groupMealCategories = () => prisma.hacker.groupBy({ by: ["mealCategory"], _count: { mealCategory: true } });
	const groupTShirtSizes = () => prisma.hacker.groupBy({ by: ["tShirtSize"], _count: { tShirtSize: true } });

	return {
		countProvisioned: () => prisma.hacker.count(),
		countConfirmed: () => prisma.hacker.count({ where: { confirmed: true } }),
		countWalkIns: () => prisma.hacker.count({ where: { walkIn: true } }),
		countCheckedIn,
		sumPresences: async () => (await prisma.presence.aggregate({ _sum: { value: true } }))._sum.value ?? 0,
		groupAttendanceByEvent,
		groupMealCategories,
		groupTShirtSizes,
		findEventNames: ids =>
			prisma.event.findMany({
				where: { id: { in: ids } },
				select: { id: true, name: true },
			}),
	};
};

export const getOperationalMetrics = async (repository: OperationalMetricsRepository) => {
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
		repository.countProvisioned(),
		repository.countConfirmed(),
		repository.countWalkIns(),
		repository.countCheckedIn(),
		repository.sumPresences(),
		repository.groupAttendanceByEvent(),
		repository.groupMealCategories(),
		repository.groupTShirtSizes(),
	]);
	const events = await repository.findEventNames(attendanceByEvent.map(({ eventId }) => eventId));
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
		presences: presenceTotal,
		attendanceData,
		mealCategoryData,
		tShirtSizeData,
	};
};
