import assert from "node:assert/strict";
import test from "node:test";
import { geographicRegion, outsideCanadaBounds, pooledInsight } from "@/components/metrics/aggregate-insights";

void test("geographic classification does not infer countries from ambiguous cities or nonanswers", () => {
	for (const label of [
		"London",
		"Ottawa",
		"No",
		"N/A",
		"Toronto, CA",
		"Other / suppressed",
		"person@example.invalid",
	])
		assert.equal(geographicRegion(label, true), "unknown");
	assert.equal(geographicRegion("Toronto, Ontario, Canada", true), "canada");
	assert.equal(geographicRegion("Delhi, India", true), "outside");
	assert.equal(geographicRegion("CA"), "canada");
	assert.equal(geographicRegion("US"), "outside");
	assert.equal(geographicRegion("États-Unis"), "outside");
});
void test("outside-Canada bounds never assume pooled answers are all international", () => {
	assert.deepEqual(
		outsideCanadaBounds([
			{ label: "Canada", value: 80 },
			{ label: "India", value: 8 },
			{ label: "Other / suppressed", value: 6 },
			{ label: "Not provided", value: 10 },
		]),
		{ lower: 8, upper: 14 },
	);
	assert.deepEqual(
		outsideCanadaBounds([
			{ label: "Canada", value: 80 },
			{ label: "Outside Canada", value: 20 },
		]),
		{ lower: 20, upper: 20 },
	);
	assert.deepEqual(
		outsideCanadaBounds(
			[
				{ label: "London", value: 10 },
				{ label: "Canada", value: 80 },
			],
			true,
		),
		{ lower: 0, upper: 10 },
	);
});
void test("suppressed-pool insights distinguish single-choice shares from overlapping mentions", () => {
	assert.deepEqual(pooledInsight([{ label: "Other / suppressed", value: 20 }], 100), { value: 20, share: 20 });
	assert.deepEqual(pooledInsight([{ label: "Other / suppressed", value: 20 }], 100, true), {
		value: 20,
		share: null,
	});
	assert.equal(pooledInsight([{ label: "Other / suppressed", value: 4 }], 100), null);
});
