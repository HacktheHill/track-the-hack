import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { archiveDashboardSchema } from "@root/private-metrics/snapshot";
import { publicMetricsSchema } from "@root/archive/metrics";
import { privateMetricsFixture } from "./helpers/private-metrics-fixture";
import { answerCoverage } from "@root/private-metrics/coverage";

void test("private archival snapshot retains all dashboard aggregates but rejects participant fields", () => {
	const fixture = structuredClone(privateMetricsFixture);
	assert.deepEqual(archiveDashboardSchema.parse(fixture), fixture);
	assert.equal(archiveDashboardSchema.safeParse({ ...fixture, email: "fixture@example.invalid" }).success, false);
	assert.equal(
		archiveDashboardSchema.safeParse({ ...fixture, metrics: { ...fixture.metrics, hackers: [{ id: "fixture" }] } })
			.success,
		false,
	);
	assert.equal(
		archiveDashboardSchema.safeParse({
			...fixture,
			metrics: {
				...fixture.metrics,
				externalMetrics: {
					...fixture.metrics.externalMetrics,
					sheet: { ...fixture.metrics.externalMetrics.sheet, emails: [] },
				},
			},
		}).success,
		false,
	);
	assert.equal(
		publicMetricsSchema.safeParse(fixture).success,
		false,
		"private payload cannot enter the public archive",
	);
});

void test("private static entry point contains no live auth, polling or API dependency", () => {
	const page = readFileSync(new URL("../private-metrics/pages/[[...path]].tsx", import.meta.url), "utf8");
	const app = readFileSync(new URL("../private-metrics/pages/_app.tsx", import.meta.url), "utf8");
	assert.match(page, /archiveDashboardSchema.parse/);
	assert.match(page, /MetricsDashboard.*archived/);
	assert.doesNotMatch(page + app, /getServerSession|SessionProvider|withTRPC|useQuery|refetchInterval|serviceWorker/);
	const headers = readFileSync(new URL("../private-metrics/hosting-assets/_headers", import.meta.url), "utf8");
	assert.match(headers, /Cache-Control: private, no-store/);
	assert.match(headers, /X-Robots-Tag: noindex/);
});

void test("answer coverage does not mistake suppressed missing answers for complete data", () => {
	assert.deepEqual(answerCoverage([{ label: "Other / suppressed", applicants: 4 }], 20), {
		missing: null,
		suppressed: 4,
		rate: "80–100%",
	});
	assert.deepEqual(
		answerCoverage(
			[
				{ label: "Not provided", applicants: 5 },
				{ label: "Other / suppressed", applicants: 4 },
			],
			20,
		),
		{ missing: 5, suppressed: 4, rate: "75%" },
	);
	assert.equal(answerCoverage([], 0).rate, "—");
});

void test("private hosting disables alternate public domains and gates all assets by hostname", () => {
	const config = readFileSync(new URL("../private-metrics/wrangler.jsonc", import.meta.url), "utf8");
	assert.match(config, /"workers_dev": false/);
	assert.match(config, /"preview_urls": false/);
	assert.match(config, /"pattern": "metrics\.hackthehill\.com", "custom_domain": true/);
	assert.match(config, /"directory": "\.\/out"/);
	const workflow = readFileSync(new URL("../.github/workflows/node.js.yml", import.meta.url), "utf8");
	assert.match(workflow, /check-private-metrics-build\.mts/);
	assert.doesNotMatch(workflow, /path:\s*private-metrics\/out/);
});
