import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory, ScannerWorkflow, TShirtSize, type PrismaClient } from "@prisma/client";
import {
	createPrismaOperationalMetricsRepository,
	getOperationalMetrics,
	type OperationalMetricsRepository,
} from "@/server/services/operational-metrics";

void test("checked-in count uses distinct participant IDs across check-in events", async t => {
	const groupBy = t.mock.fn(() => Promise.resolve([{ hackerId: "participant-1" }, { hackerId: "participant-2" }]));
	// Partial database mock exposes only the operation exercised by this repository method.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const prisma = {
		presence: { groupBy },
	} as unknown as Pick<PrismaClient, "event" | "hacker" | "presence" | "judgingRound" | "metricsSnapshot">;

	const repository = createPrismaOperationalMetricsRepository(prisma);
	assert.equal(await repository.countCheckedIn(), 2);
	assert.deepEqual(groupBy.mock.calls[0]?.arguments, [
		{
			by: ["hackerId"],
			where: { event: { scannerWorkflow: ScannerWorkflow.CHECK_IN }, value: { gt: 0 } },
		},
	]);
});

void test("attendance integrity counts only evidence missing a positive check-in", async t => {
	const hackerCount = t.mock.fn(() => Promise.resolve(0));
	const eventCount = t.mock.fn(() => Promise.resolve(1));
	// Partial database mock exposes only the operations exercised by these repository methods.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const prisma = {
		hacker: { count: hackerCount },
		event: { count: eventCount },
	} as unknown as Pick<PrismaClient, "event" | "hacker" | "presence" | "judgingRound" | "metricsSnapshot">;

	const repository = createPrismaOperationalMetricsRepository(prisma);
	assert.equal(await repository.countIssuedPassesWithoutCheckIn(), 0);
	assert.equal(await repository.countPositivePresenceWithoutCheckIn(), 0);
	assert.equal(await repository.countVisibleCheckInEvents(), 1);

	assert.deepEqual(hackerCount.mock.calls[0]?.arguments, [
		{
			where: {
				claimToken: { isNot: null },
				presences: {
					none: { value: { gt: 0 }, event: { scannerWorkflow: ScannerWorkflow.CHECK_IN } },
				},
			},
		},
	]);
	assert.deepEqual(hackerCount.mock.calls[1]?.arguments, [
		{
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
					{
						presences: {
							none: { value: { gt: 0 }, event: { scannerWorkflow: ScannerWorkflow.CHECK_IN } },
						},
					},
				],
			},
		},
	]);
	assert.deepEqual(eventCount.mock.calls[0]?.arguments, [
		{ where: { hidden: false, scannerWorkflow: ScannerWorkflow.CHECK_IN } },
	]);
});

void test("operational metrics expose only aggregate database-derived values", async () => {
	const hackerGroupings: string[][] = [];
	let summedPresences = false;
	const repository: OperationalMetricsRepository = {
		countProvisioned: () => Promise.resolve(10),
		countConfirmed: () => Promise.resolve(8),
		countWalkIns: () => Promise.resolve(2),
		countCheckedIn: () => Promise.resolve(7),
		sumPresences: () => {
			summedPresences = true;
			return Promise.resolve(5);
		},
		groupRecordedUnitsByEvent: () =>
			Promise.resolve([
				{ eventId: "event-1", _sum: { value: 3 } },
				{ eventId: "event-2", _sum: { value: 2 } },
			]),
		groupPositiveParticipantsByEvent: () =>
			Promise.resolve([
				{ eventId: "event-1", hackerId: "participant-1" },
				{ eventId: "event-1", hackerId: "participant-2" },
				{ eventId: "event-2", hackerId: "participant-1" },
			]),
		groupMealCategories: () => {
			hackerGroupings.push(["mealCategory"]);
			return Promise.resolve([{ mealCategory: MealCategory.HALAL, _count: { mealCategory: 4 } }]);
		},
		groupTShirtSizes: () => {
			hackerGroupings.push(["tShirtSize"]);
			return Promise.resolve([{ tShirtSize: TShirtSize.M, _count: { tShirtSize: 3 } }]);
		},
		findEventNames: ids => {
			assert.deepEqual(ids, ["event-1", "event-2"]);
			return Promise.resolve([
				{ id: "event-1", name: "Check-In", scannerWorkflow: ScannerWorkflow.CHECK_IN },
				{ id: "event-2", name: "Workshop", scannerWorkflow: ScannerWorkflow.ATTENDANCE },
			]);
		},
		countIssuedPassesWithoutCheckIn: () => Promise.resolve(0),
		countPositivePresenceWithoutCheckIn: () => Promise.resolve(1),
		countVisibleCheckInEvents: () => Promise.resolve(1),
		countLatestJudgingProjects: () => Promise.resolve(4),
		findMetricsSnapshots: () =>
			Promise.resolve([
				{
					source: "google-sheets",
					capturedAt: new Date("2026-09-29T12:00:00.000Z"),
					payload: {
						kind: "google-sheets",
						rows: 12,
						linkedRows: 10,
						cohorts: { applicants: 12, accepted: 10, confirmed: 8, attended: 7 },
						dimensions: {
							preferredLanguage: [
								{ label: "English", applicants: 9, accepted: 8, confirmed: 7, attended: 6 },
							],
						},
					},
				},
				{
					source: "communications",
					capturedAt: new Date("2026-09-29T13:00:00.000Z"),
					payload: { kind: "communications", acceptanceEmailsSesAccepted: 11 },
				},
				{
					source: "devpost",
					capturedAt: new Date("2026-09-29T14:00:00.000Z"),
					payload: {
						kind: "devpost",
						registrants: 9,
						activeRegistrants: 8,
						submitters: 7,
						submittedProjects: 5,
						publicProjects: 4,
						hiddenProjects: 1,
						draftProjects: 2,
						teamUpRequests: 1,
						linkage: {
							applicationRows: 12,
							uniqueApplicationEmails: 11,
							duplicateApplicationRows: 1,
							matchedRegistrants: 6,
							matchedAccepted: 5,
							matchedConfirmed: 4,
							matchedAttended: 3,
							matchedSubmitters: 4,
							matchedAcceptedSubmitters: 4,
							matchedConfirmedSubmitters: 3,
							matchedAttendedSubmitters: 2,
							unmatchedRegistrants: 3,
						},
					},
				},
			]),
	};

	const metrics = await getOperationalMetrics(repository);

	assert.deepEqual(metrics, {
		provisioned: 10,
		confirmed: 8,
		walkIn: 2,
		checkedIn: 7,
		presences: 5,
		attendanceData: [
			{ eventId: "event-1", label: "Check-In", uniqueParticipants: 2, recordedUnits: 3 },
			{ eventId: "event-2", label: "Workshop", uniqueParticipants: 1, recordedUnits: 2 },
		],
		engagementData: [
			{ key: "none", participants: 1 },
			{ key: "one", participants: 1 },
			{ key: "twoToThree", participants: 0 },
			{ key: "fourPlus", participants: 0 },
		],
		mealCategoryData: [{ mealCategory: MealCategory.HALAL, _count: { mealCategory: 4 } }],
		tShirtSizeData: [{ tShirtSize: TShirtSize.M, _count: { tShirtSize: 3 } }],
		attendanceIntegrity: {
			issuedPassesWithoutCheckIn: 0,
			positivePresenceWithoutCheckIn: 1,
			visibleCheckInEvents: 1,
		},
		funnel: {
			applications: 12,
			accepted: 10,
			acceptanceEmailsSesAccepted: 11,
			confirmed: 8,
			checkedIn: 7,
			devpostProjects: 4,
			devpostRegistrants: 9,
			devpostActiveRegistrants: 8,
			devpostSubmitters: 7,
			devpostSubmittedProjects: 5,
			devpostPublicProjects: 4,
		},
		conversions: {
			participation: {
				applicationToAccepted: { from: 12, to: 10, dropOff: 2, rate: 83.3 },
				acceptedToConfirmed: { from: 10, to: 8, dropOff: 2, rate: 80 },
				confirmedToAttended: { from: 8, to: 7, dropOff: 1, rate: 87.5 },
			},
			devpost: {
				registrantToActive: { from: 9, to: 8, dropOff: 1, rate: 88.9 },
				activeToSubmitter: { from: 8, to: 7, dropOff: 1, rate: 87.5 },
				submittedToPublicProject: { from: 5, to: 4, dropOff: 1, rate: 80 },
				publicToJudgingProject: { from: 4, to: 4, dropOff: 0, rate: 100 },
			},
		},
		dataQuality: {
			sheetRows: 12,
			sheetLinkedRows: 10,
			sheetUnlinkedRows: 2,
			duplicateApplicationRows: 1,
			devpostMatchedRegistrants: 6,
			devpostUnmatchedRegistrants: 3,
			devpostMatchedSubmitters: 4,
			devpostProjectImportGap: 0,
		},
		externalMetrics: {
			sheet: {
				capturedAt: new Date("2026-09-29T12:00:00.000Z"),
				payload: {
					kind: "google-sheets",
					rows: 12,
					linkedRows: 10,
					cohorts: { applicants: 12, accepted: 10, confirmed: 8, attended: 7 },
					dimensions: {
						preferredLanguage: [
							{ label: "English", applicants: 9, accepted: 8, confirmed: 7, attended: 6 },
						],
					},
				},
			},
			communications: {
				capturedAt: new Date("2026-09-29T13:00:00.000Z"),
				payload: { kind: "communications", acceptanceEmailsSesAccepted: 11 },
			},
			devpost: {
				capturedAt: new Date("2026-09-29T14:00:00.000Z"),
				payload: {
					kind: "devpost",
					registrants: 9,
					activeRegistrants: 8,
					submitters: 7,
					submittedProjects: 5,
					publicProjects: 4,
					hiddenProjects: 1,
					draftProjects: 2,
					teamUpRequests: 1,
					linkage: {
						applicationRows: 12,
						uniqueApplicationEmails: 11,
						duplicateApplicationRows: 1,
						matchedRegistrants: 6,
						matchedAccepted: 5,
						matchedConfirmed: 4,
						matchedAttended: 3,
						matchedSubmitters: 4,
						matchedAcceptedSubmitters: 4,
						matchedConfirmedSubmitters: 3,
						matchedAttendedSubmitters: 2,
						unmatchedRegistrants: 3,
					},
				},
			},
		},
	});
	assert.deepEqual(hackerGroupings, [["mealCategory"], ["tShirtSize"]]);
	assert.equal(summedPresences, true);
});
