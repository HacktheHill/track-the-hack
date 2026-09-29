import assert from "node:assert/strict";
import test from "node:test";
import { metricsSnapshotInputSchema, parseMetricsSnapshots } from "@/server/services/external-metrics";

void test("aggregate snapshot input rejects participant-shaped or inconsistent data", () => {
	assert.equal(
		metricsSnapshotInputSchema.safeParse({
			source: "google-sheets",
			capturedAt: "2026-09-29T12:00:00.000Z",
			payload: {
				kind: "google-sheets",
				rows: 1,
				linkedRows: 1,
				cohorts: { applicants: 1, accepted: 2, confirmed: 0, attended: 0 },
				dimensions: {},
				participantIds: ["must-not-cross-this-boundary"],
			},
		}).success,
		false,
	);
});

void test("invalid stored snapshots are ignored instead of breaking live metrics", () => {
	assert.deepEqual(
		parseMetricsSnapshots([
			{ source: "google-sheets", capturedAt: new Date(0), payload: { names: ["private"] } },
			{
				source: "communications",
				capturedAt: new Date("2026-09-29T12:00:00.000Z"),
				payload: { kind: "communications", acceptanceEmailsSesAccepted: 698 },
			},
		]),
		{
			sheet: null,
			communications: {
				capturedAt: new Date("2026-09-29T12:00:00.000Z"),
				payload: { kind: "communications", acceptanceEmailsSesAccepted: 698 },
			},
		},
	);
});
