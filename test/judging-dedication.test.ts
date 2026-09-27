import assert from "node:assert/strict";
import test from "node:test";
import { planDedicatedCategoryAssignments } from "@/server/services/judging-dedication";

void test("dedicates every category project and redistributes the specialist's unrelated visits", () => {
	const plan = planDedicatedCategoryAssignments({
		dedicatedJudgeId: "afaq",
		categoryCode: "MATHEMATECH",
		categoryProjectIds: ["p1", "p2", "p3"],
		projectLimit: 3,
		projects: [
			{ id: "p1", room: "C140", tableNumber: 1 },
			{ id: "p2", room: "C140", tableNumber: 2 },
			{ id: "p3", room: "C240", tableNumber: 30 },
			{ id: "p4", room: "C240", tableNumber: 31 },
		],
		judges: [
			{ id: "generalist", email: "a@example.com", expertise: [], exclusions: [] },
			{ id: "foss", email: "b@example.com", expertise: ["FOSS"], exclusions: ["GENERAL"] },
		],
		assignments: [
			{ id: "afaq-math", projectId: "p1", judgeId: "afaq", categoryCode: "MATHEMATECH", isMain: false },
			{ id: "other-math", projectId: "p2", judgeId: "generalist", categoryCode: "MATHEMATECH", isMain: false },
			{ id: "afaq-general", projectId: "p4", judgeId: "afaq", categoryCode: "GENERAL", isMain: true },
			{ id: "afaq-foss", projectId: "p4", judgeId: "afaq", categoryCode: "FOSS", isMain: false },
		],
	});

	assert.deepEqual(plan.errors, []);
	assert.deepEqual(plan.missingDedicatedProjectIds, ["p2", "p3"]);
	assert.deepEqual(plan.removeCategoryAssignmentIds, ["other-math"]);
	assert.deepEqual(plan.reassignments, [
		{ assignmentId: "afaq-general", targetJudgeId: "generalist" },
		{ assignmentId: "afaq-foss", targetJudgeId: "generalist" },
	]);
});

void test("fails closed when exclusions and the project cap leave no replacement", () => {
	const plan = planDedicatedCategoryAssignments({
		dedicatedJudgeId: "specialist",
		categoryCode: "MATHEMATECH",
		categoryProjectIds: ["math"],
		projectLimit: 1,
		projects: [
			{ id: "math", room: "C140", tableNumber: 1 },
			{ id: "other", room: "C240", tableNumber: 2 },
			{ id: "full", room: "C240", tableNumber: 3 },
		],
		judges: [{ id: "candidate", email: "candidate@example.com", expertise: [], exclusions: [] }],
		assignments: [
			{ id: "keep", projectId: "full", judgeId: "candidate", categoryCode: "GENERAL", isMain: true },
			{ id: "move", projectId: "other", judgeId: "specialist", categoryCode: "GENERAL", isMain: true },
		],
	});

	assert.equal(plan.reassignments.length, 0);
	assert.equal(plan.errors.length, 1);
});
