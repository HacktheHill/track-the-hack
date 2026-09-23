import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

void test("the 2026 schedule assigns operational scanner workflows", async () => {
	const source = await readFile(new URL("../prisma/hack-the-hill-iii-events.csv", import.meta.url), "utf8");
	const rows = scheduleRowsSchema.parse(await csv({ output: "json" }).fromString(source));

	assert.equal(rows.length, 41);
	assert.equal(new Set(rows.map(row => row.importKey)).size, rows.length);
	assert.ok(rows.every(row => row.roomFr.length > 0));
	for (const removedImportKey of [
		"hacking-2026-fri-2130",
		"judges-orientation-2026-sun-0930",
		"project-submission-deadline-2026-sun-1000",
	]) {
		assert.equal(
			rows.some(row => row.importKey === removedImportKey),
			false,
		);
	}
	assert.equal(rows.find(row => row.importKey === "merch-2026-fri-1700")?.scannerWorkflow, "MERCHANDISE");
	assert.equal(rows.find(row => row.importKey === "check-in-2026-fri-1700")?.scannerWorkflow, "CHECK_IN");
	assert.equal(rows.find(row => row.importKey === "late-check-in-2026-fri-2030")?.scannerWorkflow, "CHECK_IN");
	assert.ok(rows.filter(row => row.type === "FOOD").every(row => row.scannerWorkflow === "FOOD"));
});

void test("the schedule importer rejects invalid 12-hour clock values", async () => {
	const directory = await mkdtemp(join(tmpdir(), "track-the-hack-schedule-"));
	try {
		const source = await readFile(new URL("../prisma/hack-the-hill-iii-events.csv", import.meta.url), "utf8");
		for (const invalidHour of ["0:00 PM", "13:00 PM"]) {
			const input = join(directory, `${invalidHour.slice(0, 2).replace(":", "")}.csv`);
			await writeFile(input, source.replace("5:00 PM", invalidHour));
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
		const source = await readFile(new URL("../prisma/hack-the-hill-iii-events.csv", import.meta.url), "utf8");
		const input = join(directory, "localized.csv");
		await writeFile(input, source);
		const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/import-events.mts", input], {
			cwd: new URL("..", import.meta.url),
			encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stderr);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
