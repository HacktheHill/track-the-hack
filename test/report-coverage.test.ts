import assert from "node:assert/strict";
import test from "node:test";
import { minimumCategorySize } from "@root/private-metrics/disclosure";
import { participantBackgroundSchema } from "@root/private-metrics/background";
import { reportCoverage } from "@root/private-metrics/report-coverage";
import { aggregateSheetReport } from "@root/scripts/aggregate-sheet-report.mts";
import { countryLabel } from "@/components/metrics/aggregate-insights";
import { historicalLanguageMentions } from "@root/scripts/import-historical-metrics.mts";
import { privateMetricsFixture } from "./helpers/private-metrics-fixture";

void test("category sizes are metric-specific, not a blanket reduction", () => {
	for (const key of ["country", "travelCountry", "technologies", "prizes", "programmingLanguages"])
		assert.equal(minimumCategorySize(key), 1);
	for (const key of ["school", "studyLevel", "areaOfStudy"]) assert.equal(minimumCategorySize(key), 2);
	for (const key of ["gender", "racialOrEthnicBackground", "dietaryRestrictions", "travelOrigin", "exactAge"])
		assert.equal(minimumCategorySize(key), 5);
});
void test("Sheet report aggregation keeps country insight but no identities or narratives", () => {
	const headers = [
		"Submission ID",
		"Admission status",
		"RSVP Status",
		"Attended",
		"Country of residence",
		"Age at the start of Hack the Hill III",
		"Gender identity",
		"Participant ID",
		"GitHub profile",
		"What skills, tools, programming languages, or technologies would you bring to a hackathon team?",
		"Do you have any dietary restrictions or food allergies?",
	];
	const input = Array.from({ length: 6 }, (_, i) => [
		`private-id-${i}`,
		"Accepted",
		i < 4 ? "CONFIRMED" : "",
		i < 3,
		"Canada",
		i === 5 ? "invalid" : "20",
		i === 5 ? "Rare sensitive answer" : "Common",
		"private-participant",
		"https://private.invalid/person",
		i === 5 ? "Private narrative, Rust" : "Python Python",
		"No",
	]);
	const last = input[5];
	assert.ok(last);
	last[4] = "Mexico";
	input.push(["", "Accepted", "CONFIRMED", true, "Nigeria"]);
	const result = aggregateSheetReport(headers, input, {
		minimum: minimumCategorySize,
		country: countryLabel,
		languages: historicalLanguageMentions,
	});
	assert.deepEqual(result.sheet.cohorts, { applicants: 6, accepted: 6, confirmed: 4, attended: 3 });
	assert.equal(result.sheet.dimensions.country?.find(row => row.label === "Mexico")?.applicants, 1);
	assert.equal(result.sheet.dimensions.gender?.find(row => row.label === "Other / suppressed")?.applicants, 1);
	assert.equal(result.sheet.dimensions.programmingLanguages?.find(row => row.label === "Python")?.applicants, 5);
	assert.equal(result.sheet.dimensions.programmingLanguages?.find(row => row.label === "Rust")?.applicants, 1);
	assert.equal(
		result.sheet.dimensions.dietaryRestrictions?.find(row => row.label === "No restrictions reported")?.applicants,
		6,
	);
	assert.equal(result.background.ageStats[0]?.answered, 5);
	assert.equal(result.background.ageStats[3]?.mean, null);
	assert.doesNotMatch(
		JSON.stringify(result),
		/private-id|private-participant|https?:|Private narrative|Rare sensitive/,
	);
	assert.ok(
		participantBackgroundSchema.safeParse({ ...result.background, capturedAt: "2026-10-02T12:00:00.000Z" }).success,
	);
});
void test("coverage distinguishes unavailable sources, uncollected fields and intentional exclusions", () => {
	const rows = reportCoverage(privateMetricsFixture);
	assert.equal(rows.find(row => row.key === "age")?.i, "notCollected");
	assert.equal(rows.find(row => row.key === "formDuration")?.iii, "notCollected");
	assert.equal(rows.find(row => row.key === "platform")?.iii, "notRecovered");
	assert.equal(rows.find(row => row.key === "timing")?.ii, "excluded");
});
