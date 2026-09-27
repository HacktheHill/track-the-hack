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
