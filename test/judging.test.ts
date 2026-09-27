import assert from "node:assert/strict";
import test from "node:test";
import {
	coalesceAssignmentOutboxPatch,
	createRankingOutboxPatch,
	judgingOfflineNamespace,
	nextEffectiveJudgingEditTime,
} from "@/client/judging-offline-state";
import { generateJudgingAssignments } from "@/server/services/judging-assignments";
import {
	parseJudgeCsv,
	parseProjectCsv,
	type ImportedJudge,
	type ImportedJudgingProject,
} from "@/server/services/judging-import";
import { clampJudgingEditTime, judgingFieldWriteWins } from "@/server/services/judging-sync";
import { MAIN_RUBRIC, canonicalProjectCategoryCodes, mainScoreTotal, pointsForLevel } from "@/shared/judging";

const project = (number: number, overrides: Partial<ImportedJudgingProject> = {}): ImportedJudgingProject => ({
	externalId: `project-${number}`,
	name: `Project ${number}`,
	tableNumber: number,
	room: number % 2 ? "C140" : "C240",
	devpostUrl: `https://devpost.com/software/project-${number}`,
	mainTrack: "GENERAL",
	categories: [],
	...overrides,
});

const judge = (number: number, overrides: Partial<ImportedJudge> = {}): ImportedJudge => ({
	name: `Judge ${number}`,
	email: `judge${number}@example.com`,
	expertise: [],
	exclusions: [],
	...overrides,
});

void test("the 0–5 main selectors map exactly to the published 45-point rubric", () => {
	assert.deepEqual(
		[0, 1, 2, 3, 4, 5].map(level => pointsForLevel(level, 15)),
		[0, 3, 6, 9, 12, 15],
	);
	assert.deepEqual(
		[0, 1, 2, 3, 4, 5].map(level => pointsForLevel(level, 10)),
		[0, 2, 4, 6, 8, 10],
	);
	assert.deepEqual(
		[0, 1, 2, 3, 4, 5].map(level => pointsForLevel(level, 5)),
		[0, 1, 2, 3, 4, 5],
	);
	assert.equal(mainScoreTotal(Object.fromEntries(MAIN_RUBRIC.map(item => [item.key, 5]))), 45);
});

void test("canonical project exports retain CGI alongside entered prize categories", () => {
	assert.deepEqual(canonicalProjectCategoryCodes("CGI", ["FOSS", "HARDWARE"]), ["CGI", "FOSS", "HARDWARE"]);
});

void test("project import applies Civic precedence, CGI isolation, and General defaulting", async () => {
	const csv = [
		"project_name,table_number,room,category_opt_ins,eligible_category_count,devpost_url,devpost_project_id",
		'Both,1,C140,"General Challenge — Best Overall;Civic Technology",2,https://both.devpost.com,both',
		"Default,2,C140,FOSS,1,https://default.devpost.com,default",
		'CGI Conflict,3,C240,"CGI;General Challenge — Best Overall",2,https://cgi.devpost.com,cgi',
	].join("\n");
	const result = await parseProjectCsv(csv);

	assert.equal(result.rows[0]?.mainTrack, "CIVIC");
	assert.equal(result.rows[1]?.mainTrack, "GENERAL");
	assert.deepEqual(result.rows[1]?.categories, ["FOSS"]);
	assert.ok(result.warnings.some(message => message.includes("Civic takes precedence")));
	assert.ok(result.warnings.some(message => message.includes("defaulted to General")));
	assert.ok(result.errors.some(message => message.includes("CGI cannot be combined")));
});

void test("judge import normalizes identity and enforces expertise/exclusion contracts", async () => {
	const result = await parseJudgeCsv(
		[
			"judge_name,judge_email,expertise,exclusion",
			'Ada, ADA@Example.com ,"FOSS;HARDWARE",CIVIC',
			"Conflict,conflict@example.com,FOSS,FOSS",
			"Invalid,invalid@example.com,GENERAL,",
		].join("\n"),
	);

	assert.equal(result.rows[0]?.email, "ada@example.com");
	assert.deepEqual(result.rows[0]?.expertise, ["FOSS", "HARDWARE"]);
	assert.deepEqual(result.rows[0]?.exclusions, ["CIVIC"]);
	assert.ok(result.errors.some(message => message.includes("both expertise and exclusion")));
	assert.ok(result.errors.some(message => message.includes("not a mini/sponsor category")));
});

void test("generation finds the smallest balanced limit above 15 for baseline coverage", () => {
	const result = generateJudgingAssignments(
		Array.from({ length: 31 }, (_, index) => project(index + 1)),
		[judge(1), judge(2)],
	);

	assert.deepEqual(result.errors, []);
	assert.equal(result.effectiveProjectLimit, 16);
	assert.equal(result.requiresOverloadApproval, true);
	assert.deepEqual(
		result.judgeLoads.map(load => load.projects).sort((a, b) => a - b),
		[15, 16],
	);
	assert.equal(
		result.coverage.every(scope => scope.count >= 1),
		true,
	);
});

void test("generation does not raise the workload cap when greedy scope choices hide a feasible schedule", () => {
	const result = generateJudgingAssignments(
		[
			project(1),
			project(2, { categories: ["FOSS"] }),
			project(3, { mainTrack: "CIVIC", categories: ["FOSS"] }),
			project(4, { categories: ["FOSS", "HARDWARE"] }),
			project(5),
		],
		[judge(1, { exclusions: ["GENERAL"] }), judge(2, { exclusions: ["FOSS"] }), judge(3)],
		2,
	);

	assert.deepEqual(result.errors, []);
	assert.equal(result.effectiveProjectLimit, 2);
	assert.equal(result.requiresOverloadApproval, false);
	assert.equal(
		result.coverage.every(scope => scope.count >= 1),
		true,
	);
	assert.equal(
		result.judgeLoads.every(load => load.projects <= 2),
		true,
	);
});

void test("generation prefers expertise, respects exclusions, caps duplicate coverage, and is deterministic", () => {
	const projects = [project(1, { categories: ["FOSS"] }), project(2, { categories: ["FOSS"] })];
	const judges = [judge(1, { expertise: ["FOSS"] }), judge(2), judge(3), judge(4, { exclusions: ["FOSS"] })];
	const first = generateJudgingAssignments(projects, judges);
	const second = generateJudgingAssignments(projects, judges);

	assert.deepEqual(first, second);
	assert.equal(
		first.assignments.some(item => item.categoryCode === "FOSS" && item.judgeEmail === judges[0]?.email),
		true,
	);
	assert.equal(
		first.assignments.some(item => item.categoryCode === "FOSS" && item.judgeEmail === judges[3]?.email),
		false,
	);
	assert.equal(
		first.coverage.every(scope => scope.count >= 1 && scope.count <= 3),
		true,
	);
});

void test("increasing workload never bypasses a hard exclusion", () => {
	const result = generateJudgingAssignments([project(1)], [judge(1, { exclusions: ["GENERAL"] })]);

	assert.equal(result.assignments.length, 0);
	assert.equal(result.effectiveProjectLimit, 15);
	assert.ok(result.errors.some(message => message.includes("No eligible judge")));
});

void test("same-field conflicts use newest effective time and operation ID as an exact-tie breaker", () => {
	const receipt = new Date("2026-09-27T14:00:00.000Z");
	assert.equal(clampJudgingEditTime("2026-09-27T15:00:00.000Z", receipt).toISOString(), receipt.toISOString());
	assert.equal(
		judgingFieldWriteWins(new Date("2026-09-27T13:00:01.000Z"), "a", "2026-09-27T13:00:00.000Z", "z"),
		true,
	);
	assert.equal(
		judgingFieldWriteWins(new Date("2026-09-27T12:59:59.000Z"), "z", "2026-09-27T13:00:00.000Z", "a"),
		false,
	);
	assert.equal(
		judgingFieldWriteWins(new Date("2026-09-27T13:00:00.000Z"), "b", "2026-09-27T13:00:00.000Z", "a"),
		true,
	);
	assert.equal(
		judgingFieldWriteWins(new Date("2026-09-27T13:00:00.000Z"), "a", "2026-09-27T13:00:00.000Z", "b"),
		false,
	);
});

void test("offline assignment edits coalesce by entity while retaining per-field edit times", () => {
	const namespace = judgingOfflineNamespace("round-1", "judge-1");
	const first = coalesceAssignmentOutboxPatch({
		namespace,
		assignmentId: "assignment-1",
		values: { technicalLevel: 3, note: "First note" },
		editedAt: "2026-09-27T14:00:00.000Z",
		operationId: "00000000-0000-4000-8000-000000000001",
	});
	const second = coalesceAssignmentOutboxPatch({
		existing: first,
		namespace,
		assignmentId: "assignment-1",
		values: { technicalLevel: 4 },
		editedAt: "2026-09-27T14:01:00.000Z",
		operationId: "00000000-0000-4000-8000-000000000002",
	});

	assert.equal(second.key, "v1:round-1:judge-1:assignment:assignment-1");
	assert.deepEqual(second.values, { technicalLevel: 4, note: "First note" });
	assert.deepEqual(second.fieldEditedAt, {
		technicalLevel: "2026-09-27T14:01:00.000Z",
		note: "2026-09-27T14:00:00.000Z",
	});
	assert.equal(second.operationId, "00000000-0000-4000-8000-000000000002");
});

void test("offline rankings replace one atomic category list", () => {
	const patch = createRankingOutboxPatch({
		namespace: judgingOfflineNamespace("round-1", "judge-1"),
		categoryCode: "FOSS",
		projectIds: ["weak", "middle", "strong"],
		editedAt: "2026-09-27T14:02:00.000Z",
		operationId: "00000000-0000-4000-8000-000000000003",
	});

	assert.equal(patch.key, "v1:round-1:judge-1:ranking:FOSS");
	assert.deepEqual(patch.projectIds, ["weak", "middle", "strong"]);
});

void test("offline effective edit times remain strictly ordered when the device clock stalls or moves backward", () => {
	const first = nextEffectiveJudgingEditTime(Date.parse("2026-09-27T14:00:00.000Z"));
	const stalled = nextEffectiveJudgingEditTime(first.effectiveMs, first.effectiveMs);
	const backward = nextEffectiveJudgingEditTime(first.effectiveMs - 60_000, stalled.effectiveMs);

	assert.equal(stalled.effectiveMs, first.effectiveMs + 1);
	assert.equal(backward.effectiveMs, stalled.effectiveMs + 1);
	assert.equal(backward.editedAt, "2026-09-27T14:00:00.002Z");
});
