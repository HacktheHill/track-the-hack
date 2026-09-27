import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import test from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";

/* eslint-disable @typescript-eslint/consistent-type-assertions -- focused Prisma mocks expose only exercised methods */

loadEnvFile(".github/workflows/build.env");
const routerModule = import("@/server/api/routers/judging");

const session: Session = {
	user: { id: "organizer-1", isOrganizer: true, isAdmin: true },
	expires: "2099-01-01T00:00:00Z",
};

void test("CGI correction removes only main assignments and invalidates their complete ranking lists", async t => {
	const projectUpdate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 2 });
	});
	const assignmentDelete = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 2 });
	});
	const rankingDelete = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 4 });
	});
	const auditCreate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({});
	});
	const roundUpdate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 1 });
	});
	const transaction = t.mock.fn(async (operation: (client: object) => Promise<unknown>, options: object) => {
		assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
		return operation({
			judgingRound: {
				findUnique: () => Promise.resolve({ id: "round-1", state: "OPEN", assignmentVersion: 7 }),
				updateMany: roundUpdate,
			},
			judgingProject: {
				findMany: () =>
					Promise.resolve([
						{ id: "project-22", tableNumber: 22, mainTrack: "GENERAL" },
						{ id: "project-60", tableNumber: 60, mainTrack: "CIVIC" },
					]),
				updateMany: projectUpdate,
			},
			judgingAssignment: {
				findMany: (input: unknown) => {
					assert.deepEqual(input, {
						where: {
							roundId: "round-1",
							projectId: { in: ["project-22", "project-60"] },
							isMain: true,
							categoryCode: { in: ["GENERAL", "CIVIC"] },
						},
						select: {
							id: true,
							judgeId: true,
							categoryCode: true,
							technicalLevel: true,
							ideaLevel: true,
							designLevel: true,
							learningLevel: true,
							presentationLevel: true,
							note: true,
							rulesConcern: true,
							recusedAt: true,
						},
					});
					return Promise.resolve([
						{
							id: "assignment-1",
							judgeId: "judge-1",
							categoryCode: "GENERAL",
							technicalLevel: 4,
							ideaLevel: 4,
							designLevel: 4,
							learningLevel: 4,
							presentationLevel: 4,
							note: null,
							rulesConcern: false,
							recusedAt: null,
						},
						{
							id: "assignment-2",
							judgeId: "judge-2",
							categoryCode: "CIVIC",
							technicalLevel: null,
							ideaLevel: null,
							designLevel: null,
							learningLevel: null,
							presentationLevel: null,
							note: null,
							rulesConcern: false,
							recusedAt: null,
						},
					]);
				},
				deleteMany: assignmentDelete,
			},
			judgingRanking: { deleteMany: rankingDelete },
			auditEvent: { create: auditCreate },
		});
	});
	const prisma = {
		user: {
			findUnique: () =>
				Promise.resolve({
					id: "organizer-1",
					name: "Test Organizer",
					email: "test.organizer@ctn-rtc.org",
					isAdmin: true,
					disabledAt: null,
				}),
		},
		$transaction: transaction,
	} as unknown as PrismaClient;
	const { judgingRouter } = await routerModule;

	const result = await judgingRouter.createCaller({ prisma, session }).correctProjectsToCgi({
		roundId: "round-1",
		expectedAssignmentVersion: 7,
		tableNumbers: [60, 22],
		confirmDiscardMainScoring: true,
	});

	assert.deepEqual(result, {
		alreadyCorrected: false,
		assignmentVersion: 8,
		projectCount: 2,
		assignmentsRemoved: 2,
		synchronizedWorkRemoved: 1,
		rankingRowsRemoved: 4,
	});
	assert.deepEqual(roundUpdate.mock.calls[0]?.arguments[0], {
		where: { id: "round-1", assignmentVersion: 7, state: { not: "LOCKED" } },
		data: { assignmentVersion: { increment: 1 } },
	});
	assert.deepEqual(rankingDelete.mock.calls[0]?.arguments[0], {
		where: {
			OR: [
				{ judgeId: "judge-1", categoryCode: "GENERAL" },
				{ judgeId: "judge-2", categoryCode: "CIVIC" },
			],
		},
	});
	assert.deepEqual(assignmentDelete.mock.calls[0]?.arguments[0], {
		where: { id: { in: ["assignment-1", "assignment-2"] } },
	});
	assert.deepEqual(projectUpdate.mock.calls[0]?.arguments[0], {
		where: { id: { in: ["project-22", "project-60"] } },
		data: { mainTrack: "CGI" },
	});
	assert.equal(auditCreate.mock.callCount(), 1);
	const audit = auditCreate.mock.calls[0]?.arguments[0] as { data: { name: string; outcome: string; data: object } };
	assert.equal(audit.data.name, "judging.projects.main_track_corrected");
	assert.equal(audit.data.outcome, "cgi");
	assert.deepEqual(audit.data.data, {
		tableNumbers: "22,60",
		projectCount: 2,
		assignmentsRemoved: 2,
		synchronizedWorkRemoved: 1,
		rankingRowsRemoved: 4,
		assignmentVersionChanged: true,
	});
});

void test("main-track correction discards old scores and creates fresh assignments for replacement judges", async t => {
	const assignmentDelete = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 2 });
	});
	const assignmentCreate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 2 });
	});
	const projectUpdate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ id: "project-58", mainTrack: "CIVIC" });
	});
	const rankingDelete = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 3 });
	});
	const auditCreate = t.mock.fn(() => Promise.resolve({}));
	const roundUpdate = t.mock.fn(() => Promise.resolve({ count: 1 }));
	const currentAssignments = [
		{
			id: "general-michael",
			judgeId: "judge-michael",
			categoryCode: "GENERAL",
			technicalLevel: null,
			ideaLevel: null,
			designLevel: null,
			learningLevel: null,
			presentationLevel: null,
			note: null,
			rulesConcern: false,
			recusedAt: null,
		},
		{
			id: "general-rayyan",
			judgeId: "judge-rayyan",
			categoryCode: "GENERAL",
			technicalLevel: 4,
			ideaLevel: 4,
			designLevel: 4,
			learningLevel: 2,
			presentationLevel: 3,
			note: null,
			rulesConcern: false,
			recusedAt: null,
		},
	];
	const transaction = t.mock.fn(async (operation: (client: object) => Promise<unknown>, options: object) => {
		assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
		return operation({
			judgingRound: {
				findUnique: () =>
					Promise.resolve({ id: "round-1", state: "OPEN", assignmentVersion: 17, effectiveProjectLimit: 44 }),
				updateMany: roundUpdate,
			},
			judgingProject: {
				findFirst: () => Promise.resolve({ id: "project-58", tableNumber: 58, mainTrack: "GENERAL" }),
				update: projectUpdate,
			},
			judgingJudge: {
				findMany: () =>
					Promise.resolve([
						{ id: "judge-hashem", exclusions: ["HARDWARE"] },
						{ id: "judge-luis", exclusions: [] },
					]),
			},
			judgingAssignment: {
				findMany: (input: { where: { isMain?: boolean } }) =>
					input.where.isMain
						? Promise.resolve(currentAssignments)
						: Promise.resolve([
								{ judgeId: "judge-hashem", projectId: "project-56" },
								{ judgeId: "judge-luis", projectId: "project-69" },
							]),
				deleteMany: assignmentDelete,
				createMany: assignmentCreate,
			},
			judgingRanking: { deleteMany: rankingDelete },
			auditEvent: { create: auditCreate },
		});
	});
	const prisma = {
		user: {
			findUnique: () =>
				Promise.resolve({
					id: "organizer-1",
					name: "Test Organizer",
					email: "test.organizer@ctn-rtc.org",
					isAdmin: true,
					disabledAt: null,
				}),
		},
		$transaction: transaction,
	} as unknown as PrismaClient;
	const { judgingRouter } = await routerModule;

	const result = await judgingRouter.createCaller({ prisma, session }).correctProjectMainTrack({
		roundId: "round-1",
		projectId: "project-58",
		mainTrack: "CIVIC",
		judgeIds: ["judge-hashem", "judge-luis"],
		expectedAssignmentVersion: 17,
		confirmDiscardMainScoring: true,
	});

	assert.deepEqual(result, {
		alreadyCorrected: false,
		assignmentVersion: 18,
		assignmentsRemoved: 2,
		synchronizedWorkRemoved: 1,
		assignmentsCreated: 2,
		rankingRowsRemoved: 3,
	});
	assert.deepEqual(projectUpdate.mock.calls[0]?.arguments[0], {
		where: { id: "project-58" },
		data: { mainTrack: "CIVIC" },
	});
	assert.deepEqual(assignmentDelete.mock.calls[0]?.arguments[0], {
		where: { id: { in: ["general-michael", "general-rayyan"] } },
	});
	assert.deepEqual(assignmentCreate.mock.calls[0]?.arguments[0], {
		data: [
			{
				roundId: "round-1",
				projectId: "project-58",
				judgeId: "judge-hashem",
				categoryCode: "CIVIC",
				isMain: true,
				expertiseMatch: false,
				calibrationAnchor: false,
				assignmentReason: "administrator main-track correction",
				fieldTimestamps: {},
				fieldOperationIds: {},
			},
			{
				roundId: "round-1",
				projectId: "project-58",
				judgeId: "judge-luis",
				categoryCode: "CIVIC",
				isMain: true,
				expertiseMatch: false,
				calibrationAnchor: false,
				assignmentReason: "administrator main-track correction",
				fieldTimestamps: {},
				fieldOperationIds: {},
			},
		],
	});
	assert.equal(auditCreate.mock.callCount(), 1);
});

void test("MLH category reconciliation adds only missing categories and assignments", async t => {
	const categoryCreate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 2 });
	});
	const assignmentCreate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 2 });
	});
	const rankingDelete = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 1 });
	});
	const auditCreate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({});
	});
	const roundUpdate = t.mock.fn(() => Promise.resolve({ count: 1 }));
	const transaction = t.mock.fn(async (operation: (client: object) => Promise<unknown>, options: object) => {
		assert.deepEqual(options, {
			isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
			maxWait: 10_000,
			timeout: 30_000,
		});
		return operation({
			judgingRound: {
				findUnique: () => Promise.resolve({ id: "round-1", state: "OPEN", assignmentVersion: 18 }),
				updateMany: roundUpdate,
			},
			judgingJudge: {
				findFirst: () =>
					Promise.resolve({
						id: "judge-mlh",
						expertise: ["MLH", "GEMINI", "GODADDY", "SOLANA"],
						exclusions: [],
					}),
			},
			judgingProject: {
				findMany: () =>
					Promise.resolve([
						{ id: "project-1", tableNumber: 1, categories: [{ code: "GEMINI" }] },
						{ id: "project-84", tableNumber: 84, categories: [{ code: "UI_UX" }] },
					]),
			},
			judgingProjectCategory: { createMany: categoryCreate },
			judgingAssignment: {
				findMany: () =>
					Promise.resolve([
						{
							id: "existing-gemini",
							projectId: "project-1",
							judgeId: "judge-mlh",
							categoryCode: "GEMINI",
						},
					]),
				createMany: assignmentCreate,
			},
			judgingRanking: { deleteMany: rankingDelete },
			auditEvent: { create: auditCreate },
		});
	});
	const prisma = {
		user: {
			findUnique: () =>
				Promise.resolve({
					id: "organizer-1",
					name: "Test Organizer",
					email: "test.organizer@ctn-rtc.org",
					isAdmin: true,
					disabledAt: null,
				}),
		},
		$transaction: transaction,
	} as unknown as PrismaClient;
	const { judgingRouter } = await routerModule;

	const result = await judgingRouter.createCaller({ prisma, session }).reconcileMlhProjectCategories({
		roundId: "round-1",
		judgeId: "judge-mlh",
		projects: [
			{ projectId: "project-1", categoryCodes: ["GEMINI"] },
			{ projectId: "project-84", categoryCodes: ["SOLANA", "GODADDY"] },
		],
		expectedAssignmentVersion: 18,
		confirmAddOnly: true,
	});

	assert.deepEqual(result, {
		alreadyApplied: false,
		assignmentVersion: 19,
		projectCount: 2,
		categoriesCreated: 2,
		assignmentsCreated: 2,
		rankingRowsRemoved: 1,
	});
	assert.deepEqual(categoryCreate.mock.calls[0]?.arguments[0], {
		data: [
			{ roundId: "round-1", projectId: "project-84", code: "SOLANA" },
			{ roundId: "round-1", projectId: "project-84", code: "GODADDY" },
		],
	});
	assert.deepEqual(assignmentCreate.mock.calls[0]?.arguments[0], {
		data: [
			{
				roundId: "round-1",
				projectId: "project-84",
				judgeId: "judge-mlh",
				categoryCode: "SOLANA",
				isMain: false,
				expertiseMatch: true,
				calibrationAnchor: false,
				assignmentReason: "Devpost MLH category reconciliation",
				fieldTimestamps: {},
				fieldOperationIds: {},
			},
			{
				roundId: "round-1",
				projectId: "project-84",
				judgeId: "judge-mlh",
				categoryCode: "GODADDY",
				isMain: false,
				expertiseMatch: true,
				calibrationAnchor: false,
				assignmentReason: "Devpost MLH category reconciliation",
				fieldTimestamps: {},
				fieldOperationIds: {},
			},
		],
	});
	assert.deepEqual(rankingDelete.mock.calls[0]?.arguments[0], {
		where: {
			roundId: "round-1",
			OR: [
				{ judgeId: "judge-mlh", categoryCode: "SOLANA" },
				{ judgeId: "judge-mlh", categoryCode: "GODADDY" },
			],
		},
	});
	assert.equal(auditCreate.mock.callCount(), 1);
	const audit = auditCreate.mock.calls[0]?.arguments[0] as { data: { name: string; outcome: string; data: object } };
	assert.equal(audit.data.name, "judging.categories.reconciled");
	assert.equal(audit.data.outcome, "applied");
	assert.deepEqual(audit.data.data, {
		projectCount: 2,
		categoriesCreated: 2,
		assignmentsCreated: 2,
		rankingRowsRemoved: 1,
		assignmentVersionChanged: true,
	});
});

void test("retiring MLH removes the selected judge's work and every MLH scope", async t => {
	const roundUpdate = t.mock.fn(() => Promise.resolve({ count: 1 }));
	const rankingDelete = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 9 });
	});
	const assignmentDelete = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 14 });
	});
	const categoryDelete = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 11 });
	});
	const auditCreate = t.mock.fn(() => Promise.resolve({}));
	const transaction = t.mock.fn(async (operation: (client: object) => Promise<unknown>, options: object) => {
		assert.deepEqual(options, {
			isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
			maxWait: 10_000,
			timeout: 30_000,
		});
		return operation({
			judgingRound: {
				findUnique: () => Promise.resolve({ id: "round-1", state: "OPEN", assignmentVersion: 21 }),
				updateMany: roundUpdate,
			},
			judgingJudge: {
				findFirst: () => Promise.resolve({ id: "judge-farhan" }),
			},
			judgingRanking: { deleteMany: rankingDelete },
			judgingAssignment: { deleteMany: assignmentDelete },
			judgingProjectCategory: { deleteMany: categoryDelete },
			auditEvent: { create: auditCreate },
		});
	});
	const prisma = {
		user: {
			findUnique: () =>
				Promise.resolve({
					id: "organizer-1",
					name: "Test Organizer",
					email: "test.organizer@ctn-rtc.org",
					isAdmin: true,
					disabledAt: null,
				}),
		},
		$transaction: transaction,
	} as unknown as PrismaClient;
	const { judgingRouter } = await routerModule;

	const result = await judgingRouter.createCaller({ prisma, session }).retireMlhJudging({
		roundId: "round-1",
		judgeId: "judge-farhan",
		expectedAssignmentVersion: 21,
		confirmDiscardJudgeWorkAndCloseMlh: true,
	});

	assert.deepEqual(result, {
		assignmentVersion: 22,
		assignmentsRemoved: 14,
		categoriesRemoved: 11,
		rankingsRemoved: 9,
	});
	assert.deepEqual(assignmentDelete.mock.calls[0]?.arguments[0], {
		where: {
			roundId: "round-1",
			OR: [
				{ judgeId: "judge-farhan" },
				{
					categoryCode: {
						in: ["ELEVENLABS", "GEMINI", "SOLANA", "TIGER_DATA", "PRESAGE", "VULTR", "AUTH0", "GODADDY"],
					},
				},
			],
		},
	});
	assert.deepEqual(categoryDelete.mock.calls[0]?.arguments[0], {
		where: {
			roundId: "round-1",
			code: {
				in: ["ELEVENLABS", "GEMINI", "SOLANA", "TIGER_DATA", "PRESAGE", "VULTR", "AUTH0", "GODADDY"],
			},
		},
	});
	assert.equal(auditCreate.mock.callCount(), 1);
});
