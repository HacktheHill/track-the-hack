import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { applicationHeaders, applicationRow, appsScriptSource, createResponseHarness, responseHeaders, type SheetRequest } from "@root/test/helpers/google-sheets-harness";

const link = `https://track.example/rsvp/manage#${"a".repeat(43)}.${"b".repeat(43)}`;
const stableId = "c".repeat(32);
const batchSchema = z.object({ hackers: z.array(z.object({ id: z.string() })) });
const idsSchema = z.object({ ids: z.array(z.string()) });
const applicant = (submissionId: string, status: string, extras: Record<string, string> = {}) => applicationRow({
	"Submission ID": submissionId, "Admission status": status,
	"What unisex T-shirt size would you prefer?": "M", ...extras,
});
const api = (request: SheetRequest) => {
	if (request.url.endsWith("/hackers")) {
		const hackers = batchSchema.parse(JSON.parse(request.options.payload)).hackers;
		return { status: 200, body: JSON.stringify({ processed: hackers.length }) };
	}
	if (request.url.endsWith("/dietary-reconciliation")) {
		const participants = z.object({ participants: z.array(z.object({ id: z.string(), mealCategory: z.string() })) }).parse(JSON.parse(request.options.payload)).participants;
		return { status: 200, body: JSON.stringify({ processed: participants.length }) };
	}
	const ids = idsSchema.parse(JSON.parse(request.options.payload)).ids;
	return { status: 200, body: JSON.stringify({ records: ids.map(id => ({ id, confirmed: false, status: "PENDING", rsvpLink: link })), missingIds: [] }) };
};
const field = (rows: Array<Array<string | number | boolean | Date>>, row: number, header: string) =>
	rows[row]?.[applicationHeaders.length + responseHeaders.indexOf(header)];

void test("the visible RSVP menu command targets the complete Accepted audience", () => {
	assert.match(
		appsScriptSource,
		/\.addItem\("Prepare accepted RSVP invitations", "prepareAcceptedRowsForRsvpFromMenu"\)/,
	);
	assert.match(
		appsScriptSource,
		/\.addItem\("Refresh RSVP responses", "refreshResponseRsvpStatusFromMenu"\)/,
	);
	assert.match(
		appsScriptSource,
		/function prepareAcceptedRowsForRsvpFromMenu\(\) \{[\s\S]*prepareAcceptedRowsForRsvp\(\)/,
	);
	const sheet = createResponseHarness({ applications: [
		applicant("accepted-en", "Accepted"), applicant("rejected", "Rejected"), applicant("accepted-fr", "Acceptée"),
	], fetch: api });
	assert.deepEqual(sheet.run("prepareAcceptedRowsForRsvpFromMenu"), { accepted: 2, processed: 2, batches: 1 });
	assert.deepEqual(sheet.toasts(), [{
		message: "Prepared 2 Accepted RSVP invitations in 1 batch.",
		title: "RSVP preparation complete",
		timeout: 10,
	}]);
});

void test("review and preparation use Admission status, not the highlighted selection", () => {
	const sheet = createResponseHarness({ applications: [
		applicant("accepted-en", "Accepted"), applicant("rejected", "Rejected"),
		applicant("accepted-fr", "Acceptée"), applicant("waitlisted", "Waitlisted"),
	], fetch: api });
	assert.deepEqual(sheet.run("reviewAcceptedRowsForRsvp"), { accepted: 2 });
	assert.equal(sheet.requests.length, 0);
	assert.equal(field(sheet.rows(), 1, "Participant ID"), "");
	assert.deepEqual(sheet.run("prepareAcceptedRowsForRsvp"), { accepted: 2, processed: 2, batches: 1 });
	const posted = batchSchema.parse(JSON.parse(sheet.requests[0]?.options.payload ?? "{}"));
	assert.equal(posted.hackers.length, 2);
	assert.ok(field(sheet.rows(), 1, "Participant ID"));
	assert.equal(field(sheet.rows(), 2, "Participant ID"), "");
	assert.ok(field(sheet.rows(), 3, "Participant ID"));
	assert.ok(field(sheet.rows(), 1, "RSVP Refreshed At") instanceof Date);
	assert.equal(sheet.locked(), false);
});

void test("RSVP preparation releases the Sheet-wide lock during Tracker API calls", () => {
	const sheet = createResponseHarness({
		applications: [applicant("accepted", "Accepted")],
		fetch: request => {
			assert.equal(sheet.locked(), false, "Bulk network work must not block pass activation");
			return api(request);
		},
	});
	assert.deepEqual(sheet.run("prepareAcceptedRowsForRsvp"), { accepted: 1, processed: 1, batches: 1 });
});

void test("preflight rejects duplicate and invalid Accepted rows before any write", () => {
	const sheet = createResponseHarness({ applications: [
		applicant("same", "Accepted"), applicant("same", "Accepté"),
		applicant("bad-shirt", "Accepted", { "What unisex T-shirt size would you prefer?": "?" }),
		applicant("bad id", "Accepted"),
	], fetch: api });
	assert.throws(() => sheet.run("prepareAcceptedRowsForRsvp"), /row 3: duplicate Submission ID.*row 4: Unsupported T-shirt size.*row 5: invalid Submission ID/);
	assert.equal(sheet.requests.length, 0);
	assert.equal(field(sheet.rows(), 1, "Participant ID"), "");
});

void test("the designated test action prepares only its Accepted submission", () => {
	const sheet = createResponseHarness({ applications: [applicant("one", "Accepted"), applicant("two", "Accepted")], testSubmissionId: "two", fetch: api });
	assert.deepEqual(sheet.run("prepareTestSubmissionForRsvp"), { accepted: 1, processed: 1, batches: 1 });
	assert.equal(field(sheet.rows(), 1, "Participant ID"), "");
	assert.ok(field(sheet.rows(), 2, "Participant ID"));
});

void test("501 Accepted rows use bounded API batches", () => {
	const sheet = createResponseHarness({ applications: Array.from({ length: 501 }, (_, index) => applicant(`submission-${index}`, "Accepted")), fetch: api });
	assert.deepEqual(sheet.run("prepareAcceptedRowsForRsvp"), { accepted: 501, processed: 501, batches: 6 });
	const sizes = sheet.requests.filter(request => request.url.endsWith("/hackers")).map(request =>
		batchSchema.parse(JSON.parse(request.options.payload)).hackers.length);
	assert.deepEqual(sizes, [100, 100, 100, 100, 100, 1]);
});

void test("server failure leaves stable IDs and existing RSVP links for retry", () => {
	let fail = true;
	const sheet = createResponseHarness({ applications: [applicant("one", "Accepted")], operational: [[stableId, "", "", "", link]], fetch: request => {
		if (fail && request.url.endsWith("/hackers")) return { status: 503, body: "temporarily unavailable" };
		return api(request);
	} });
	assert.throws(() => sheet.run("prepareAcceptedRowsForRsvp"), /response rows 2-2 failed/);
	assert.equal(field(sheet.rows(), 1, "Participant ID"), stableId);
	assert.equal(field(sheet.rows(), 1, "RSVP Link"), link);
	assert.equal(field(sheet.rows(), 1, "RSVP Refreshed At"), "");
	fail = false;
	assert.deepEqual(sheet.run("prepareAcceptedRowsForRsvp"), { accepted: 1, processed: 1, batches: 1 });
	const posts = sheet.requests.filter(request => request.url.endsWith("/hackers"));
	for (const post of posts) assert.equal(batchSchema.parse(JSON.parse(post.options.payload)).hackers[0]?.id, stableId);
});

void test("RSVP Refreshed At advances only after complete reconciliation", () => {
	let fail = true;
	const sheet = createResponseHarness({ applications: [applicant("one", "Accepted")], operational: [[stableId, "M", "STANDARD", "2030-09-30T03:59:59.000Z", link, "PENDING"]], fetch: request => {
		if (fail) return { status: 503, body: "unavailable" };
		return api(request);
	} });
	assert.throws(() => sheet.run("refreshResponseRsvpStatus"), /Tracker API 503/);
	assert.equal(field(sheet.rows(), 1, "RSVP Refreshed At"), "");
	fail = false;
	assert.deepEqual(sheet.run("refreshResponseRsvpStatus"), { refreshed: 1, pending: 1, confirmed: 0, declined: 0 });
	assert.ok(field(sheet.rows(), 1, "RSVP Refreshed At") instanceof Date);
});

void test("the visible refresh command reports all three RSVP states", () => {
	const ids = ["a", "b", "c"].map(character => character.repeat(32));
	const statuses = ["PENDING", "CONFIRMED", "DECLINED"] as const;
	const sheet = createResponseHarness({
		applications: statuses.map((_, index) => applicant(`submission-${index}`, "Accepted")),
		operational: ids.map(id => [id, "M", "STANDARD", "2030-09-30T03:59:59.000Z", link, "PENDING"]),
		fetch: request => {
			const requested = idsSchema.parse(JSON.parse(request.options.payload)).ids;
			return {
				status: 200,
				body: JSON.stringify({
					records: requested.map((id, index) => ({ id, confirmed: statuses[index] === "CONFIRMED", status: statuses[index], rsvpLink: link })),
					missingIds: [],
				}),
			};
		},
	});
	assert.deepEqual(sheet.run("refreshResponseRsvpStatusFromMenu"), { refreshed: 3, pending: 1, confirmed: 1, declined: 1 });
	assert.deepEqual(sheet.toasts(), [{
		message: "Refreshed 3 RSVP responses: 1 confirmed, 1 declined, 1 pending.",
		title: "RSVP responses refreshed",
		timeout: 10,
	}]);
});

void test("refresh refuses missing Tracker participants before changing Sheet RSVP fields", () => {
	const sheet = createResponseHarness({
		applications: [applicant("one", "Accepted")],
		operational: [[stableId, "M", "STANDARD", "2030-09-30T03:59:59.000Z", link, "PENDING", "", "", "old-sync", false, "old-refresh"]],
		fetch: () => ({ status: 200, body: JSON.stringify({ records: [], missingIds: [stableId] }) }),
	});
	assert.throws(() => sheet.run("refreshResponseRsvpStatus"), /could not find 1 provisioned participant.*No RSVP fields were changed/);
	assert.equal(field(sheet.rows(), 1, "Last Sync"), "old-sync");
	assert.equal(field(sheet.rows(), 1, "RSVP Refreshed At"), "old-refresh");
});

void test("existing dietary repair changes only the meal category and generic sync timestamp", () => {
	const id = "a".repeat(32);
	const sheet = createResponseHarness({
		applications: [applicant("one", "Accepted", { "Select all that apply. (Vegetarian)": "true", "Select all that apply. (Peanut allergy)": "true" })],
		operational: [[id, "M", "VEGETARIAN", "2030-09-30T03:59:59.000Z", link, "CONFIRMED", "old-cancel-link", "", "", false, "old-refresh"]],
		fetch: api,
	});
	assert.deepEqual(sheet.run("reviewExistingDietaryCategories"), { changed: 1 });
	assert.equal(sheet.requests.length, 0);
	assert.deepEqual(sheet.run("reconcileExistingDietaryCategories"), { changed: 1, processed: 1 });
	assert.equal(field(sheet.rows(), 1, "Meal Category"), "OTHER");
	assert.equal(field(sheet.rows(), 1, "RSVP Status"), "CONFIRMED");
	assert.equal(field(sheet.rows(), 1, "RSVP Link"), link);
	assert.equal(field(sheet.rows(), 1, "RSVP Refreshed At"), "old-refresh");
	assert.ok(field(sheet.rows(), 1, "Last Sync") instanceof Date);
	assert.equal(sheet.requests.filter(request => request.url.endsWith("/hackers") || request.url.endsWith("/claim")).length, 0);
});
