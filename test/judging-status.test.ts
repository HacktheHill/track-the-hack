import assert from "node:assert/strict";
import test from "node:test";
import { getJudgingProjectStatus, isJudgingAssignmentStarted } from "@/client/judging-status";

const baseState = {
	localOnly: false,
	complete: false,
	allRecused: false,
	allRecusalsAccepted: false,
	hasPendingRecusal: false,
	hasUnresolvedEligibility: false,
	started: false,
};

void test("judging project statuses distinguish synced progress, completion, and organiser review", () => {
	assert.equal(getJudgingProjectStatus(baseState), "not-started");
	assert.equal(getJudgingProjectStatus({ ...baseState, started: true }), "in-progress-synced");
	assert.equal(
		getJudgingProjectStatus({ ...baseState, complete: true, started: true }),
		"complete-synced",
	);
	assert.equal(
		getJudgingProjectStatus({ ...baseState, hasUnresolvedEligibility: true, started: true }),
		"waiting-organiser",
	);
});

void test("local-only work takes precedence over every server-side status", () => {
	assert.equal(
		getJudgingProjectStatus({
			...baseState,
			localOnly: true,
			complete: true,
			allRecused: true,
			allRecusalsAccepted: true,
			started: true,
		}),
		"stored-locally",
	);
});

void test("recusal status distinguishes pending and accepted project-wide recusals", () => {
	assert.equal(
		getJudgingProjectStatus({
			...baseState,
			allRecused: true,
			hasPendingRecusal: true,
			started: true,
		}),
		"recusal-requested",
	);
	assert.equal(
		getJudgingProjectStatus({
			...baseState,
			complete: true,
			allRecused: true,
			allRecusalsAccepted: true,
			started: true,
		}),
		"recusal-accepted",
	);
	assert.equal(
		getJudgingProjectStatus({
			...baseState,
			hasPendingRecusal: true,
			started: true,
		}),
		"waiting-organiser",
	);
});

void test("any rubric, eligibility, note, concern, or recusal edit starts an assignment", () => {
	const assignment = {
		completedAt: null,
		note: null,
		rulesConcern: false,
		recusalReason: null,
		recusedAt: null,
		miniEligibility: null,
		miniScore: null,
		technicalLevel: null,
		ideaLevel: null,
		designLevel: null,
		learningLevel: null,
		presentationLevel: null,
	};

	assert.equal(isJudgingAssignmentStarted(assignment), false);
	for (const change of [
		{ presentationLevel: 0 },
		{ ideaLevel: 3 },
		{ miniScore: 1 },
		{ miniEligibility: "UNSURE" },
		{ note: "Private note" },
		{ rulesConcern: true },
		{ recusalReason: "Conflict" },
	]) {
		assert.equal(isJudgingAssignmentStarted({ ...assignment, ...change }), true);
	}
});
