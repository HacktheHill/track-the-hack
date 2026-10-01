import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { publicMetricsSchema } from "@root/archive/metrics";
import metrics from "@root/archive/data/metrics.json";

void test("archive metrics accept only the public, organiser-provided headline statistics", () => {
	assert.deepEqual(publicMetricsSchema.parse(metrics), metrics);
	assert.equal(metrics.participants, 350);
	assert.equal(metrics.preliminary, true);
});

void test("archive metrics reject internal dashboards, identifiers, and unexpected fields", () => {
	for (const extra of [{ emails: ["private@example.com"] }, { funnel: {} }, { cohorts: [] }, { token: "secret" }]) {
		assert.equal(publicMetricsSchema.safeParse({ ...metrics, ...extra }).success, false);
	}
	assert.equal(publicMetricsSchema.safeParse({ ...metrics, projects: -1 }).success, false);
	assert.equal(publicMetricsSchema.safeParse({ ...metrics, asOf: "2026-99-99" }).success, false);
});

void test("the live build remains separate from the archive's shell and export configuration", () => {
	const live = fs.readFileSync("next.config.js", "utf8");
	assert.ok(!live.includes('output: "export"'));
	assert.ok(!live.includes("archive/components"));
	const shell = fs.readFileSync("archive/components/App.tsx", "utf8");
	assert.ok(!shell.includes("next-auth"));
	assert.ok(!shell.includes("trpc"));
});
