import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { applicationHeaders, applicationRow, createSheetHarness } from "@root/test/helpers/google-sheets-harness";

const response = applicationRow({
	"Submission ID": "J1exyzX",
	"What unisex T-shirt size would you prefer?": "M",
	"Admission status": "Accepted",
});
const firstNewColumn = applicationHeaders.length;

void test("one selected response row issues a pass with a saved reusable ID", () => {
	const requests: string[] = [];
	const sheet = createSheetHarness({
		applications: [response],
		fetch: request => {
			requests.push(request.url);
			const saved = sheet.savedApplications()[1];
			assert.ok(saved?.[firstNewColumn], "Participant ID must be flushed before API calls");
			return { status: 200, body: '{"claimUrl":"https://track.example/claim#token","expiresAt":"2030-09-30T02:00:00.000Z"}' };
		},
	});
	sheet.run("issuePassForSelectedRow");
	const firstId = sheet.savedApplications()[1]?.[firstNewColumn];
	assert.match(String(firstId), /^[0-9a-f]{64}$/);
	assert.deepEqual(requests.map(url => url.split("/").at(-1)), ["claim"]);
	assert.equal(sheet.savedApplications()[0]?.[firstNewColumn], "Participant ID");
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn + 5] ?? "", "");
	sheet.run("issuePassForSelectedRow");
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn], firstId);
	assert.equal(sheet.uuidCalls(), 2);
});

void test("a failed pass request preserves the ID and does not mark an RSVP as ready", () => {
	const sheet = createSheetHarness({
		applications: [response],
		fetch: () => ({ status: 503, body: "unavailable" }),
	});
	assert.throws(() => sheet.run("issuePassForSelectedRow"), /Tracker API 503/);
	assert.match(String(sheet.savedApplications()[1]?.[firstNewColumn]), /^[0-9a-f]{64}$/);
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn + 5] ?? "", "");
});

void test("a row must be accepted before the pass action writes to Tracker", () => {
	let calls = 0;
	const sheet = createSheetHarness({
		applications: [applicationRow({ "Submission ID": "J1exyzX", "Admission status": "Rejected" })],
		fetch: () => { calls += 1; return { status: 200, body: "{}" }; },
	});
	assert.throws(() => sheet.run("issuePassForSelectedRow"), /Admission status Accepted/);
	assert.equal(calls, 0);
});

void test("RSVP preparation and reconciliation stay on the response row", () => {
	let reconciliationCount = 0;
	const rsvpLink = `https://track.example/rsvp/manage#${"a".repeat(43)}.${"b".repeat(43)}`;
	const sheet = createSheetHarness({
		applications: [response],
		fetch: request => {
			if (request.url.endsWith("/hackers")) return { status: 200, body: '{"processed":1}' };
			const { ids } = z.object({ ids: z.array(z.string()) }).parse(JSON.parse(request.options.payload));
			reconciliationCount += 1;
			return {
				status: 200,
				body: JSON.stringify({ records: [{ id: ids[0], confirmed: reconciliationCount > 1, status: reconciliationCount > 1 ? "CONFIRMED" : "PENDING", rsvpLink, cancellationLink: reconciliationCount > 1 ? "https://track.example/cancel#token" : undefined }], missingIds: [] }),
			};
		},
	});
	sheet.run("prepareSelectedRowsForRsvp");
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn + 5], "PENDING");
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn + 4], rsvpLink);
	sheet.run("refreshResponseRsvpStatus");
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn + 5], "CONFIRMED");
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn + 6], "https://track.example/cancel#token");
	assert.equal(sheet.savedRows().length, 0, "New workflow must not create the legacy operations tab");
});

void test("reconciliation distinguishes a declined response from no answer", () => {
	const rsvpLink = `https://track.example/rsvp/manage#${"a".repeat(43)}.${"b".repeat(43)}`;
	const sheet = createSheetHarness({
		applications: [response],
		fetch: request => {
			if (request.url.endsWith("/hackers")) return { status: 200, body: '{"processed":1}' };
			const { ids } = z.object({ ids: z.array(z.string()) }).parse(JSON.parse(request.options.payload));
			return { status: 200, body: JSON.stringify({ records: [{ id: ids[0], confirmed: false, status: "DECLINED", rsvpLink }], missingIds: [] }) };
		},
	});
	sheet.run("prepareSelectedRowsForRsvp");
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn + 5], "DECLINED");
	sheet.run("refreshResponseRsvpStatus");
	assert.equal(sheet.savedApplications()[1]?.[firstNewColumn + 5], "DECLINED");
});
