import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import csv from "csvtojson";
import { z } from "zod";

const scheduleRowsSchema = z.array(
	z
		.object({ importKey: z.string(), type: z.string(), scannerWorkflow: z.string(), roomFr: z.string().min(1) })
		.passthrough(),
);

const scheduleSource = `importKey,seriesKey,start,end,hidden,name,nameFr,type,scannerEnabled,scannerWorkflow,host,description,descriptionFr,room,roomFr,image,link,linkText,linkTextFr,maxCheckIns
merch-test,merch-test,9/25/2030 5:00 PM,9/25/2030 7:00 PM,TRUE,Merch,Marchandise,GENERAL,TRUE,MERCHANDISE,,Merchandise pickup.,Ramassage de marchandises.,Lobby,Hall d'entrée,,,,,1
check-in-test,check-in-test,9/25/2030 5:00 PM,9/25/2030 7:00 PM,FALSE,Check-In,Enregistrement,GENERAL,TRUE,CHECK_IN,,Participant check-in.,Enregistrement des participants.,Lobby,Hall d'entrée,,,,,1
late-check-in-test,late-check-in-test,9/25/2030 8:30 PM,9/25/2030 10:00 PM,TRUE,Late Check-In,Enregistrement tardif,GENERAL,TRUE,CHECK_IN,,Late participant check-in.,Enregistrement tardif des participants.,Lobby,Hall d'entrée,,,,,1
food-test,food-test,9/25/2030 10:00 PM,9/26/2030 1:00 AM,FALSE,Snacks,Collations,FOOD,TRUE,FOOD,,Test food service.,Service alimentaire d'essai.,Food room,Salle de restauration,,,,,2
`;

void test("the private schedule contract assigns operational scanner workflows", async () => {
	const rows = scheduleRowsSchema.parse(await csv({ output: "json" }).fromString(scheduleSource));

	assert.equal(rows.length, 4);
	assert.equal(new Set(rows.map(row => row.importKey)).size, rows.length);
	assert.ok(rows.every(row => row.roomFr.length > 0));
	assert.equal(rows.find(row => row.importKey === "merch-test")?.scannerWorkflow, "MERCHANDISE");
	assert.equal(rows.find(row => row.importKey === "check-in-test")?.scannerWorkflow, "CHECK_IN");
	assert.equal(rows.find(row => row.importKey === "late-check-in-test")?.scannerWorkflow, "CHECK_IN");
	assert.ok(rows.filter(row => row.type === "FOOD").every(row => row.scannerWorkflow === "FOOD"));
});

void test("the schedule importer rejects invalid 12-hour clock values", async () => {
	const directory = await mkdtemp(join(tmpdir(), "track-the-hack-schedule-"));
	try {
		for (const invalidHour of ["0:00 PM", "13:00 PM"]) {
			const input = join(directory, `${invalidHour.slice(0, 2).replace(":", "")}.csv`);
			await writeFile(input, scheduleSource.replace("5:00 PM", invalidHour));
			const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/import-events.mts", input], {
				cwd: new URL("..", import.meta.url),
				encoding: "utf8",
			});
			assert.notEqual(result.status, 0, `${invalidHour} must fail validation`);
			assert.match(result.stderr, /Invalid Toronto date/);
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

void test("the schedule importer accepts the authoritative French room column", async () => {
	const directory = await mkdtemp(join(tmpdir(), "track-the-hack-schedule-"));
	try {
		const input = join(directory, "localized.csv");
		await writeFile(input, scheduleSource);
		const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/import-events.mts", input], {
			cwd: new URL("..", import.meta.url),
			encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stderr);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

void test("the schedule importer requires an explicit private input path", () => {
	const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/import-events.mts"], {
		cwd: new URL("..", import.meta.url),
		encoding: "utf8",
	});
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /Pass the path to a private schedule CSV/);
});
