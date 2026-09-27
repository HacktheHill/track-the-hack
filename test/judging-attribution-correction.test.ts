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

void test("judge attribution correction preserves submitted work while transferring the complete visit", async t => {
	const assignmentUpdate = t.mock.fn((input: unknown) => Promise.resolve(input));
	const rankingUpdate = t.mock.fn((input: unknown) => Promise.resolve({ count: 1 }));
	const roundUpdate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ count: 1 });
	});
	const auditCreate = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({});
	});
	const sourceAssignments = [
		{
			id: "general-70",
			categoryCode: "GENERAL",
			isMain: true,
			completedAt: new Date("2026-09-27T16:43:56Z"),
			technicalLevel: 3,
			ideaLevel: 3,
			designLevel: 3,
			learningLevel: 3,
			presentationLevel: 2,
			note: "French judge score",
		},
		{
			id: "ui-70",
			categoryCode: "UI_UX",
			isMain: false,
			completedAt: new Date("2026-09-27T16:44:11Z"),
			miniEligibility: "ELIGIBLE",
			miniScore: 2,
			note: "AI",
		},
	];
	const transaction = t.mock.fn(async (operation: (client: object) => Promise<unknown>, options: object) => {
		assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
		return operation({
			judgingRound: {
				findUnique: () =>
					Promise.resolve({ id: "round-1", state: "OPEN", assignmentVersion: 18, effectiveProjectLimit: 44 }),
				updateMany: roundUpdate,
			},
			judgingProject: {
				findFirst: () => Promise.resolve({ id: "project-70", tableNumber: 70, name: "CalmID" }),
			},
			judgingJudge: {
				findFirst: (input: { where: { id: string } }) =>
					Promise.resolve(
						input.where.id === "judge-agam"
							? { id: "judge-agam", name: "Agam Singh", exclusions: [], expertise: [] }
							: { id: "judge-waaberi", name: "Waaberi", exclusions: [], expertise: [] },
					),
			},
			judgingAssignment: {
				findMany: (input: { where: { judgeId: string } }) =>
					Promise.resolve(
						input.where.judgeId === "judge-agam"
							? sourceAssignments
							: [{ projectId: "other-project", categoryCode: "GENERAL" }],
					),
				update: assignmentUpdate,
			},
			judgingRanking: { count: () => Promise.resolve(2), updateMany: rankingUpdate },
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

	const result = await judgingRouter.createCaller({ prisma, session }).correctProjectVisitAttribution({
		roundId: "round-1",
		projectId: "project-70",
		sourceJudgeId: "judge-agam",
		targetJudgeId: "judge-waaberi",
		expectedAssignmentVersion: 18,
		previewOnly: false,
		confirmPreserveSubmittedWork: true,
	});

	assert.deepEqual(result, {
		previewOnly: false,
		assignmentVersion: 18,
		proposedAssignmentVersion: 19,
		project: { id: "project-70", tableNumber: 70, name: "CalmID" },
		sourceJudge: { id: "judge-agam", name: "Agam Singh" },
		targetJudge: { id: "judge-waaberi", name: "Waaberi" },
		scopeCount: 2,
		completedScopeCount: 2,
		categories: ["GENERAL", "UI_UX"],
		rankingRowsInvalidated: 2,
	});
	assert.equal(assignmentUpdate.mock.callCount(), 2);
	for (const call of assignmentUpdate.mock.calls) {
		const update = call.arguments[0] as { data: Record<string, unknown> };
		assert.deepEqual(update.data, {
			judgeId: "judge-waaberi",
			expertiseMatch: false,
			assignmentReason: "administrator judge attribution correction",
		});
		assert.equal("technicalLevel" in update.data, false);
		assert.equal("miniScore" in update.data, false);
		assert.equal("note" in update.data, false);
	}
	assert.equal(rankingUpdate.mock.callCount(), 4);
	assert.deepEqual(roundUpdate.mock.calls[0]?.arguments[0], {
		where: { id: "round-1", assignmentVersion: 18, state: { not: "LOCKED" } },
		data: { assignmentVersion: { increment: 1 } },
	});
	const audit = auditCreate.mock.calls[0]?.arguments[0] as { data: { outcome: string; data: object } };
	assert.equal(audit.data.outcome, "attribution_corrected");
	assert.deepEqual(audit.data.data, {
		tableNumber: 70,
		sourceJudgeId: "judge-agam",
		targetJudgeId: "judge-waaberi",
		scopeCount: 2,
		completedScopeCount: 2,
		rankingRowsInvalidated: 2,
		preservedSubmittedWork: true,
		assignmentVersionChanged: true,
	});
});
