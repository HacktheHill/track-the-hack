import assert from "node:assert/strict";
import test from "node:test";
import { buildDevpostMetricsSnapshot } from "@/server/services/devpost-metrics-import";

void test("Devpost import links by normalized email and emits aggregates only", () => {
	const payload = buildDevpostMetricsSnapshot(
		[
			{
				"Project Status": "Submitted (Gallery/Visible)",
				"Submitter Email": "hacker@example.com",
				field33: "teammate@example.com",
			},
			{ "Project Status": "Draft", "Submitter Email": "draft@example.com" },
		],
		[{ Email: "HACKER@example.com" }, { Email: "teammate@example.com" }, { Email: "unmatched@example.com" }],
		[
			{
				"Submission ID": "first",
				"Email address": "hacker@example.com",
				"Admission status": "Rejected",
			},
			{
				"Submission ID": "latest",
				"Email address": "hacker@example.com",
				"Admission status": "Accepted",
				"RSVP Status": "CONFIRMED",
				Attended: "TRUE",
			},
		],
		{ activeRegistrants: 3, submitters: 2, teamUpRequests: 0 },
	);

	assert.deepEqual(payload.linkage, {
		applicationRows: 2,
		uniqueApplicationEmails: 1,
		duplicateApplicationRows: 1,
		matchedRegistrants: 1,
		matchedAccepted: 1,
		matchedConfirmed: 1,
		matchedAttended: 1,
		matchedSubmitters: 1,
		matchedAcceptedSubmitters: 1,
		matchedConfirmedSubmitters: 1,
		matchedAttendedSubmitters: 1,
		unmatchedRegistrants: 2,
	});
	assert.equal(JSON.stringify(payload).includes("hacker@example.com"), false);
});
