import assert from "node:assert/strict";
import test from "node:test";
import {
	acceptedSheetRowsToOperationalRecords,
	loadTallySheetFixture,
	syncTallyFixtureToSheet,
} from "@root/scripts/dev-tally-sheet.mjs";

const fixtureUrl = new URL("./fixtures/dev-tally-sheet.json", import.meta.url);

void test("the local Tally and Sheet double exports only accepted operational fields", async () => {
	const fixture = await loadTallySheetFixture(fixtureUrl);
	const sheetRows = syncTallyFixtureToSheet(fixture);
	assert.equal(sheetRows.length, 3);
	assert.equal(sheetRows[0]?.email, "normal-participant@example.test");

	const records = acceptedSheetRowsToOperationalRecords(sheetRows, {
		now: Date.parse("2026-08-23T12:00:00.000Z"),
		participantIdFor: row => `e2e-${row.submissionId}-0123456789`,
	});

	assert.deepEqual(records, [
		{
			id: "e2e-tally-dev-normal-0123456789",
			tShirtSize: "M",
			mealCategory: "OTHER",
			acceptanceExpiry: "2026-08-30T12:00:00.000Z",
			walkIn: false,
		},
		{
			id: "e2e-tally-dev-walk-in-0123456789",
			tShirtSize: "L",
			mealCategory: "STANDARD",
			acceptanceExpiry: "2026-08-24T12:00:00.000Z",
			walkIn: true,
		},
	]);
	assert.deepEqual(Object.keys(records[0] ?? {}).sort(), [
		"acceptanceExpiry",
		"id",
		"mealCategory",
		"tShirtSize",
		"walkIn",
	]);
	assert.doesNotMatch(JSON.stringify(records), /email|fullName|waiver|dietaryDetails|tally-dev-rejected/);
});

void test("the local Sheet double rejects ambiguous fixture reviews", async () => {
	const fixture = await loadTallySheetFixture(fixtureUrl);
	const submission = fixture.tallySubmissions[0];
	const review = fixture.sheetReviews[0];
	assert.ok(submission);
	assert.ok(review);
	assert.throws(
		() =>
			syncTallyFixtureToSheet({
				tallySubmissions: [submission],
				sheetReviews: [],
			}),
		/Missing Sheet review: tally-dev-normal/,
	);
	assert.throws(
		() =>
			syncTallyFixtureToSheet({
				tallySubmissions: [],
				sheetReviews: [review, { ...review }],
			}),
		/Duplicate Sheet review: tally-dev-normal/,
	);
});
