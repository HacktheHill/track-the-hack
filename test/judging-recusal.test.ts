import assert from "node:assert/strict";
import test from "node:test";
import { planRecusalReplacements } from "@/server/services/judging-recusal";

void test("project-wide recusal keeps a complete visit together when one eligible judge can take it", () => {
	const plan = planRecusalReplacements({
		sourceJudgeId: "judge-source",
		projectId: "project-70",
		projectLimit: 15,
		projects: [
			{ id: "project-69", room: "C240", tableNumber: 69 },
			{ id: "project-70", room: "C240", tableNumber: 70 },
		],
		judges: [
			{ id: "judge-source", email: "source@example.com", expertise: [], exclusions: [] },
			{ id: "judge-near", email: "near@example.com", expertise: [], exclusions: [] },
			{ id: "judge-far", email: "far@example.com", expertise: [], exclusions: [] },
		],
		assignments: [
			{
				id: "scope-general",
				projectId: "project-70",
				judgeId: "judge-source",
				categoryCode: "GENERAL",
				isMain: true,
				recused: false,
			},
			{
				id: "scope-ui",
				projectId: "project-70",
				judgeId: "judge-source",
				categoryCode: "UI_UX",
				isMain: false,
				recused: false,
			},
			{
				id: "near-visit",
				projectId: "project-69",
				judgeId: "judge-near",
				categoryCode: "GENERAL",
				isMain: true,
				recused: false,
			},
		],
	});

	assert.deepEqual(plan, {
		replacements: [
			{ sourceAssignmentId: "scope-general", targetJudgeId: "judge-far" },
			{ sourceAssignmentId: "scope-ui", targetJudgeId: "judge-far" },
		],
		errors: [],
	});
});

void test("recusal replacement splits scopes when exclusions prevent one complete replacement visit", () => {
	const plan = planRecusalReplacements({
		sourceJudgeId: "judge-source",
		projectId: "project-1",
		projectLimit: 1,
		projects: [{ id: "project-1", room: "C140", tableNumber: 1 }],
		judges: [
			{ id: "judge-source", email: "source@example.com", expertise: [], exclusions: [] },
			{ id: "judge-main", email: "main@example.com", expertise: [], exclusions: ["UI_UX"] },
			{ id: "judge-ui", email: "ui@example.com", expertise: ["UI_UX"], exclusions: ["GENERAL"] },
		],
		assignments: [
			{
				id: "scope-general",
				projectId: "project-1",
				judgeId: "judge-source",
				categoryCode: "GENERAL",
				isMain: true,
				recused: false,
			},
			{
				id: "scope-ui",
				projectId: "project-1",
				judgeId: "judge-source",
				categoryCode: "UI_UX",
				isMain: false,
				recused: false,
			},
		],
	});

	assert.deepEqual(plan, {
		replacements: [
			{ sourceAssignmentId: "scope-general", targetJudgeId: "judge-main" },
			{ sourceAssignmentId: "scope-ui", targetJudgeId: "judge-ui" },
		],
		errors: [],
	});
});

void test("recusal replacement reports a warning when exclusions leave a scope uncovered", () => {
	const plan = planRecusalReplacements({
		sourceJudgeId: "judge-source",
		projectId: "project-1",
		projectLimit: 15,
		projects: [{ id: "project-1", room: "C140", tableNumber: 1 }],
		judges: [
			{ id: "judge-source", email: "source@example.com", expertise: [], exclusions: [] },
			{ id: "judge-other", email: "other@example.com", expertise: [], exclusions: ["GENERAL"] },
		],
		assignments: [
			{
				id: "scope-general",
				projectId: "project-1",
				judgeId: "judge-source",
				categoryCode: "GENERAL",
				isMain: true,
				recused: false,
			},
		],
	});

	assert.deepEqual(plan.replacements, []);
	assert.deepEqual(plan.errors, ["No eligible replacement is available for GENERAL."]);
});
