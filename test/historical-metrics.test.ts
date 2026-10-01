import assert from "node:assert/strict";
import test from "node:test";
import { historicalArchiveSchema } from "@root/private-metrics/history";
import { operationalEvents, shirtSizeOrder } from "@root/private-metrics/operations";
import { aggregateHistoricalDump, historicalLanguageMentions } from "@root/scripts/import-historical-metrics.mts";
import { readSqlTables } from "@root/scripts/historical-sql.mts";
import type { HistoricalArchive } from "@root/private-metrics/history";
import { privateMetricsFixture } from "./helpers/private-metrics-fixture";

const fixtureHistory = () => {
	assert.ok(privateMetricsFixture.history);
	return structuredClone(privateMetricsFixture.history);
};
const firstEdition = (history: HistoricalArchive) => {
	const first = history.editions[0];
	assert.ok(first);
	return first;
};
const firstDimension = (history: HistoricalArchive) => {
	const first = firstEdition(history).dimensions[0];
	assert.ok(first);
	return first;
};

void test("SQL literal reader handles both dump formats without retaining unselected credentials", () => {
	const sql = `CREATE TABLE \`Fixture\` (\n \`id\` int,\n \`label\` text,\n \`credential\` text\n) ENGINE=InnoDB;
INSERT INTO \`Fixture\`(\`id\`,\`label\`,\`credential\`) VALUES (1,"comma, semicolon; and \\\"quote\\\"","fake-secret");
INSERT INTO \`Fixture\` VALUES (2,'single ''quote'' and \\n newline','not-retained');`;
	const tables = readSqlTables(sql, { Fixture: ["id", "label"] });
	assert.deepEqual(
		tables.Fixture?.map(row => row.id),
		[1, 2],
	);
	assert.equal(tables.Fixture?.[0]?.label, 'comma, semicolon; and "quote"');
	assert.equal(tables.Fixture?.[1]?.label, "single 'quote' and \n newline");
	assert.doesNotMatch(JSON.stringify(tables), /fake-secret|not-retained|credential/);
});

void test("HTH I aggregation excludes HackHers and uses the earliest relevant check-in edit", () => {
	const columns = ["submissionID", "email", "attendanceType", "confirmed", "walkIn", "gender", "linkGithub"];
	const table = (name: string, fields: string[], rows: unknown[][]) =>
		`CREATE TABLE \`${name}\` (\n${fields.map(field => `\`${field}\` text`).join(",\n")}\n) ENGINE=InnoDB;\nINSERT INTO \`${name}\` VALUES ${rows.map(row => `(${row.map(value => (value === null ? "NULL" : JSON.stringify(value))).join(",")})`).join(",")};`;
	const hackers = Array.from({ length: 10 }, (_, index) => [
		`p${index}`,
		`fixture${index}@example.invalid`,
		"IN_PERSON",
		1,
		0,
		index < 5 ? "A" : "B",
		"https://example.invalid/private-profile",
	]);
	const sql =
		table("HackerInfo", columns, [
			...hackers,
			["hh", "hackhers@example.invalid", "IN_PERSON", 1, 1, "rare", null],
		]) +
		table(
			"AuditLog",
			["timestamp", "action", "details", "user_id"],
			[
				["2024-02-03 10:00:00", "WalkIn", "private audit text", "hh"],
				["2024-02-03 11:00:00", "Presence", "Private name checkedIn updated to true.", "p0"],
				["2024-02-03 12:00:00", "Presence", "Private name checkedIn updated to false.", "p0"],
				["2024-02-03 10:00:00", "Presence", "Private name hackherCheckIn updated to true.", "p1"],
			],
		) +
		table(
			"PresenceInfo",
			["hackerInfoId", "checkedIn"],
			[
				["p0", 1],
				["p1", 1],
				["hh", 1],
			],
		);
	const aggregate = aggregateHistoricalDump(sql, "i");
	assert.equal(aggregate.populations.registrations, 10);
	assert.equal(aggregate.populations.checkIn, 1);
	assert.equal(aggregate.turnout.to, 1);
	assert.equal(aggregate.quality.find(row => row.key === "excludedHackHers")?.value, 1);
	assert.doesNotMatch(JSON.stringify(aggregate), /@|https?:|Private name|private audit|private-profile|"p0"/);
});

void test("historical language mentions preserve report patterns and correct C++ case sensitivity", () => {
	assert.deepEqual(historicalLanguageMentions("C++, c++, C++, Python3, HTML5, JavaScript"), [
		"Python",
		"JavaScript",
		"HTML",
		"C++",
	]);
	assert.deepEqual(historicalLanguageMentions("Java, Go, CSS, C#"), ["Java", "CSS", "C#", "Go"]);
	assert.deepEqual(historicalLanguageMentions("Golang, JavaScript"), ["JavaScript"]);
	assert.deepEqual(historicalLanguageMentions(""), []);
});

void test("historical schema rejects participant fields, small categories and incompatible totals", () => {
	const history = fixtureHistory();
	assert.ok(historicalArchiveSchema.safeParse(history).success);
	assert.equal(historicalArchiveSchema.safeParse({ ...history, participants: [] }).success, false);
	firstEdition(history).stats.push({ key: "firstName", value: 5, unit: "count" });
	assert.equal(historicalArchiveSchema.safeParse(history).success, false);
	const small = fixtureHistory();
	firstDimension(small).rows = [
		{ label: "Rare school", value: 1 },
		{ label: "Other / suppressed", value: 19 },
	];
	assert.equal(historicalArchiveSchema.safeParse(small).success, false);
	firstDimension(small).rows = [{ label: "fixture@example.invalid", value: 20 }];
	assert.equal(historicalArchiveSchema.safeParse(small).success, false);
	const inconsistent = fixtureHistory();
	firstEdition(inconsistent).populations.preEvent++;
	assert.equal(historicalArchiveSchema.safeParse(inconsistent).success, false);
});

void test("repeated events stay separate, missing dates are explicit, and shirts sort naturally", () => {
	const rows = operationalEvents(
		[
			{ eventId: "a", label: "Lunch", uniqueParticipants: 10, recordedUnits: 12 },
			{ eventId: "b", label: "Lunch", uniqueParticipants: 9, recordedUnits: 10 },
			{ eventId: "c", label: "Intro to Hardware", uniqueParticipants: 8, recordedUnits: 8 },
		],
		"en",
	);
	assert.deepEqual(
		rows.map(row => row.displayGroup),
		["food", "food", "workshops"],
	);
	assert.deepEqual(
		rows.slice(0, 2).map(row => row.displayLabel),
		["Lunch · record 1/2", "Lunch · record 2/2"],
	);
	assert.equal(rows[0]?.uniqueParticipants, 10, "unique counts are not summed across event records");
	assert.equal(rows[0]?.missingSessionDate, true);
	assert.deepEqual(
		["NONE", "XL", "S", "XS", "M", "XXL", "L"].sort((a, b) => shirtSizeOrder(a) - shirtSizeOrder(b)),
		["XS", "S", "M", "L", "XL", "XXL", "NONE"],
	);
});
