import {
	JudgingRoundState,
	ScannerWorkflow,
	type MealCategory,
	type PrismaClient,
	type TShirtSize,
} from "@prisma/client";
import bundledDevpostMetrics from "@/data/hth3-devpost-metrics.json";
import { devpostMetricsSnapshotSchema, parseMetricsSnapshots } from "@/server/services/external-metrics";

const bundledDevpostSnapshot = {
	capturedAt: new Date(bundledDevpostMetrics.capturedAt),
	payload: devpostMetricsSnapshotSchema.parse(bundledDevpostMetrics.payload),
};

export type OperationalMetricsRepository = {
	countProvisioned(): Promise<number>;
	countConfirmed(): Promise<number>;
	countWalkIns(): Promise<number>;
	countCheckedIn(): Promise<number>;
	sumPresences(): Promise<number>;
	groupRecordedUnitsByEvent(): Promise<Array<{ eventId: string; _sum: { value: number | null } }>>;
	groupPositiveParticipantsByEvent(): Promise<Array<{ eventId: string; hackerId: string }>>;
	groupMealCategories(): Promise<Array<{ mealCategory: MealCategory; _count: { mealCategory: number } }>>;
	groupTShirtSizes(): Promise<Array<{ tShirtSize: TShirtSize; _count: { tShirtSize: number } }>>;
	findEventNames(ids: string[]): Promise<Array<{ id: string; name: string; scannerWorkflow: ScannerWorkflow }>>;
	countIssuedPassesWithoutCheckIn(): Promise<number>;
	countPositivePresenceWithoutCheckIn(): Promise<number>;
	countVisibleCheckInEvents(): Promise<number>;
	countLatestJudgingProjects(): Promise<number>;
	findMetricsSnapshots(): Promise<Array<{ source: string; payload: unknown; capturedAt: Date }>>;
};

const positiveCheckInPresence = {
	value: { gt: 0 },
	event: { scannerWorkflow: ScannerWorkflow.CHECK_IN },
} as const;

export const createPrismaOperationalMetricsRepository = (
	prisma: Pick<PrismaClient, "event" | "hacker" | "presence" | "judgingRound" | "metricsSnapshot">,
): OperationalMetricsRepository => {
	// Keep Prisma's groupBy inference outside the contextual repository return
	// type; Prisma validates each query, and the repository exposes its result.
	const groupRecordedUnitsByEvent = () =>
		prisma.presence.groupBy({ by: ["eventId"], where: { value: { gt: 0 } }, _sum: { value: true } });
	const groupPositiveParticipantsByEvent = () =>
		prisma.presence.groupBy({ by: ["eventId", "hackerId"], where: { value: { gt: 0 } } });
	const countCheckedIn = async () =>
		(
			await prisma.presence.groupBy({
				by: ["hackerId"],
				where: positiveCheckInPresence,
			})
		).length;
	const groupMealCategories = () => prisma.hacker.groupBy({ by: ["mealCategory"], _count: { mealCategory: true } });
	const groupTShirtSizes = () => prisma.hacker.groupBy({ by: ["tShirtSize"], _count: { tShirtSize: true } });

	return {
		countProvisioned: () => prisma.hacker.count(),
		countConfirmed: () => prisma.hacker.count({ where: { confirmed: true } }),
		countWalkIns: () => prisma.hacker.count({ where: { walkIn: true } }),
		countCheckedIn,
		sumPresences: async () => (await prisma.presence.aggregate({ _sum: { value: true } }))._sum.value ?? 0,
		groupRecordedUnitsByEvent,
		groupPositiveParticipantsByEvent,
		groupMealCategories,
		groupTShirtSizes,
		findEventNames: ids =>
			prisma.event.findMany({
				where: { id: { in: ids } },
				select: { id: true, name: true, scannerWorkflow: true },
			}),
		countIssuedPassesWithoutCheckIn: () =>
			prisma.hacker.count({
				where: {
					claimToken: { isNot: null },
					presences: { none: positiveCheckInPresence },
				},
			}),
		countPositivePresenceWithoutCheckIn: () =>
			prisma.hacker.count({
				where: {
					AND: [
						{
							presences: {
								some: {
									value: { gt: 0 },
									event: { scannerWorkflow: { not: ScannerWorkflow.CHECK_IN } },
								},
							},
						},
						{ presences: { none: positiveCheckInPresence } },
					],
				},
			}),
		countVisibleCheckInEvents: () =>
			prisma.event.count({ where: { hidden: false, scannerWorkflow: ScannerWorkflow.CHECK_IN } }),
		countLatestJudgingProjects: async () =>
			(
				await prisma.judgingRound.findFirst({
					where: { state: { in: [JudgingRoundState.OPEN, JudgingRoundState.LOCKED] } },
					orderBy: { createdAt: "desc" },
					select: { _count: { select: { projects: true } } },
				})
			)?._count.projects ?? 0,
		findMetricsSnapshots: () =>
			prisma.metricsSnapshot.findMany({
				where: { source: { in: ["google-sheets", "communications", "devpost"] } },
				select: { source: true, payload: true, capturedAt: true },
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
		recordedUnitsByEvent,
		positiveParticipantsByEvent,
		mealCategoryData,
		tShirtSizeData,
		issuedPassesWithoutCheckIn,
		positivePresenceWithoutCheckIn,
		visibleCheckInEvents,
		devpostProjects,
		metricsSnapshotRows,
	] = await Promise.all([
		repository.countProvisioned(),
		repository.countConfirmed(),
		repository.countWalkIns(),
		repository.countCheckedIn(),
		repository.sumPresences(),
		repository.groupRecordedUnitsByEvent(),
		repository.groupPositiveParticipantsByEvent(),
		repository.groupMealCategories(),
		repository.groupTShirtSizes(),
		repository.countIssuedPassesWithoutCheckIn(),
		repository.countPositivePresenceWithoutCheckIn(),
		repository.countVisibleCheckInEvents(),
		repository.countLatestJudgingProjects(),
		repository.findMetricsSnapshots(),
	]);
	const parsedExternal = parseMetricsSnapshots(metricsSnapshotRows);
	const external = {
		...parsedExternal,
		devpost: parsedExternal.devpost ?? bundledDevpostSnapshot,
	};
	const eventIds = [
		...new Set([
			...recordedUnitsByEvent.map(({ eventId }) => eventId),
			...positiveParticipantsByEvent.map(({ eventId }) => eventId),
		]),
	];
	const events = await repository.findEventNames(eventIds);
	const eventNames = new Map(events.map(({ id, name }) => [id, name]));
	const eventWorkflows = new Map(events.map(({ id, scannerWorkflow }) => [id, scannerWorkflow]));
	const recordedUnits = new Map(recordedUnitsByEvent.map(({ eventId, _sum }) => [eventId, _sum.value ?? 0]));
	const uniqueParticipants = new Map<string, number>();
	for (const { eventId } of positiveParticipantsByEvent) {
		uniqueParticipants.set(eventId, (uniqueParticipants.get(eventId) ?? 0) + 1);
	}
	const attendanceData = eventIds
		.flatMap(eventId => {
			const label = eventNames.get(eventId);
			return label === undefined
				? []
				: [
						{
							eventId,
							label,
							uniqueParticipants: uniqueParticipants.get(eventId) ?? 0,
							recordedUnits: recordedUnits.get(eventId) ?? 0,
						},
					];
		})
		.sort(
			(left, right) =>
				right.uniqueParticipants - left.uniqueParticipants || left.label.localeCompare(right.label),
		);
	const checkedInIds = new Set(
		positiveParticipantsByEvent
			.filter(({ eventId }) => eventWorkflows.get(eventId) === ScannerWorkflow.CHECK_IN)
			.map(({ hackerId }) => hackerId),
	);
	const engagementEventsByParticipant = new Map<string, Set<string>>();
	for (const { eventId, hackerId } of positiveParticipantsByEvent) {
		if (!checkedInIds.has(hackerId) || eventWorkflows.get(eventId) === ScannerWorkflow.CHECK_IN) continue;
		const participantEvents = engagementEventsByParticipant.get(hackerId) ?? new Set<string>();
		participantEvents.add(eventId);
		engagementEventsByParticipant.set(hackerId, participantEvents);
	}
	const engagementData = [
		{ key: "none", min: 0, max: 0 },
		{ key: "one", min: 1, max: 1 },
		{ key: "twoToThree", min: 2, max: 3 },
		{ key: "fourPlus", min: 4, max: Number.POSITIVE_INFINITY },
	].map(({ key, min, max }) => ({
		key,
		participants: [...checkedInIds].filter(hackerId => {
			const count = engagementEventsByParticipant.get(hackerId)?.size ?? 0;
			return count >= min && count <= max;
		}).length,
	}));
	const applications = external.sheet?.payload.cohorts.applicants ?? null;
	const accepted = external.sheet?.payload.cohorts.accepted ?? null;
	const devpost = external.devpost?.payload ?? null;
	const conversion = (from: number | null, to: number | null) => ({
		from,
		to,
		dropOff: from === null || to === null ? null : Math.max(0, from - to),
		rate: from === null || to === null || from === 0 ? null : Math.round((to / from) * 1000) / 10,
	});

	return {
		provisioned,
		confirmed,
		walkIn,
		checkedIn,
		presences: presenceTotal,
		attendanceData,
		engagementData,
		mealCategoryData,
		tShirtSizeData,
		attendanceIntegrity: {
			issuedPassesWithoutCheckIn,
			positivePresenceWithoutCheckIn,
			visibleCheckInEvents,
		},
		funnel: {
			applications,
			accepted,
			acceptanceEmailsSesAccepted: external.communications?.payload.acceptanceEmailsSesAccepted ?? null,
			confirmed,
			checkedIn,
			devpostProjects,
			devpostRegistrants: devpost?.registrants ?? null,
			devpostActiveRegistrants: devpost?.activeRegistrants ?? null,
			devpostSubmitters: devpost?.submitters ?? null,
			devpostSubmittedProjects: devpost?.submittedProjects ?? null,
			devpostPublicProjects: devpost?.publicProjects ?? null,
		},
		conversions: {
			participation: {
				applicationToAccepted: conversion(applications, accepted),
				acceptedToConfirmed: conversion(accepted, confirmed),
				confirmedToAttended: conversion(confirmed, checkedIn),
			},
			devpost: {
				registrantToActive: conversion(devpost?.registrants ?? null, devpost?.activeRegistrants ?? null),
				activeToSubmitter: conversion(devpost?.activeRegistrants ?? null, devpost?.submitters ?? null),
				submittedToPublicProject: conversion(
					devpost?.submittedProjects ?? null,
					devpost?.publicProjects ?? null,
				),
				publicToJudgingProject: conversion(devpost?.publicProjects ?? null, devpostProjects),
			},
		},
		dataQuality: {
			sheetRows: external.sheet?.payload.rows ?? null,
			sheetLinkedRows: external.sheet?.payload.linkedRows ?? null,
			sheetUnlinkedRows: external.sheet ? external.sheet.payload.rows - external.sheet.payload.linkedRows : null,
			duplicateApplicationRows: devpost?.linkage.duplicateApplicationRows ?? null,
			devpostMatchedRegistrants: devpost?.linkage.matchedRegistrants ?? null,
			devpostUnmatchedRegistrants: devpost?.linkage.unmatchedRegistrants ?? null,
			devpostMatchedSubmitters: devpost?.linkage.matchedSubmitters ?? null,
			devpostProjectImportGap: devpost ? Math.max(0, devpost.publicProjects - devpostProjects) : null,
		},
		externalMetrics: external,
	};
};
