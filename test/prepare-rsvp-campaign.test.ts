import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareRsvpRecipients, recipientCsv, responseRowsFromMatrix } from "@root/scripts/prepare-rsvp-campaign.mts";

const baseUrl = "https://tracker.hackthehill.com";
const link = `${baseUrl}/rsvp/manage#${"a".repeat(43)}.${"b".repeat(43)}`;
const row = {
	"Submission ID": "J1exyzX",
	"Admission status": "Accepted",
	"Participant ID": "participant_0123456789_abcdef",
	"RSVP Link": link,
	"RSVP Status": "PENDING",
	"RSVP Deadline": "2030-09-30T03:59:59.000Z",
	"Email address": "Alex@example.com",
	"First name": "Alex",
};

void test("campaign preparation outputs only pending accepted rows and private template fields", () => {
	const recipients = prepareRsvpRecipients([
		{ ...row, "Admission status": "Rejected" },
		row,
	], baseUrl, new Date("2026-09-23T00:00:00Z"));
	assert.equal(recipients.length, 1);
	assert.equal(recipients[0]?.email, "alex@example.com");
	assert.equal(recipients[0]?.rsvpUrl, link);
	assert.match(recipientCsv(recipients), /email,name,rsvpUrl,deadlineEn,deadlineFr/);
	assert.doesNotMatch(recipientCsv(recipients), /J1exyzX|participant_0123456789_abcdef/);
});

void test("French accepted status and applicant email are supported", () => {
	const [recipient] = prepareRsvpRecipients([{
		...row,
		"Admission status": "Acceptée",
		"Email address": "",
		"Adresse courriel": "alex@example.com",
		"First name": "",
		"Prénom": "Alex",
	}], baseUrl, new Date("2026-09-23T00:00:00Z"));
	assert.equal(recipient?.email, "alex@example.com");
	assert.equal(recipient?.name, "Alex");
});

void test("campaign preparation rejects ID-only links, duplicate addresses, and expired deadlines", () => {
	assert.throws(() => prepareRsvpRecipients([{ ...row, "RSVP Link": `${baseUrl}/rsvp/${row["Participant ID"]}` }], baseUrl), /management link/);
	assert.throws(() => prepareRsvpRecipients([row, { ...row, "Participant ID": "participant_9876543210_abcdef" }], baseUrl), /duplicate email/);
	assert.throws(() => prepareRsvpRecipients([{ ...row, "RSVP Deadline": "2020-09-30T03:59:59.000Z" }], baseUrl), /deadline has passed/);
});

void test("CSV header mapping tolerates unrelated Tally duplicates but rejects duplicate contact or Tracker headers", () => {
	const headers = ["Submission ID", "Repeated question", "Repeated question", ...Object.keys(row).filter(key => key !== "Submission ID")];
	const values = ["J1exyzX", "first", "second", ...Object.entries(row).filter(([key]) => key !== "Submission ID").map(([, value]) => value)];
	assert.equal(responseRowsFromMatrix([headers, values])[0]?.["Email address"], "Alex@example.com");
	assert.throws(() => responseRowsFromMatrix([[...headers, "Email address"], [...values, "other@example.com"]]), /duplicate Email address/);
});

void test("the CLI writes a private minimal CSV without sending anything", async () => {
	const directory = await mkdtemp(join(tmpdir(), "track-rsvp-campaign-"));
	try {
		const input = join(directory, "responses.csv");
		const output = join(directory, "recipients.csv");
		const fields = ["Admission status", "Participant ID", "RSVP Link", "RSVP Status", "RSVP Deadline", "Email address", "First name"];
		const values = [row["Admission status"], row["Participant ID"], row["RSVP Link"], row["RSVP Status"], row["RSVP Deadline"], row["Email address"], row["First name"]];
		await writeFile(input, `${fields.join(",")}\n${values.join(",")}\n`);
		const log = execFileSync("node", ["--import", "tsx", "scripts/prepare-rsvp-campaign.mts", "--input", input, "--output", output, "--base-url", baseUrl], { cwd: process.cwd(), encoding: "utf8" });
		assert.match(log, /No email was sent/);
		assert.equal((await stat(output)).mode & 0o777, 0o600);
		assert.match(await readFile(output, "utf8"), /alex@example.com/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
