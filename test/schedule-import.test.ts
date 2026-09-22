import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import csv from "csvtojson";
import { z } from "zod";

const scheduleRowsSchema = z.array(
	z.object({ importKey: z.string(), type: z.string(), scannerWorkflow: z.string() }).passthrough(),
);

void test("the 2026 schedule assigns operational scanner workflows", async () => {
	const source = await readFile(new URL("../prisma/hack-the-hill-iii-events.csv", import.meta.url), "utf8");
	const rows = scheduleRowsSchema.parse(await csv({ output: "json" }).fromString(source));

	assert.equal(rows.length, 44);
	assert.equal(new Set(rows.map(row => row.importKey)).size, rows.length);
	assert.equal(rows.find(row => row.importKey === "merch-2026-fri-1700")?.scannerWorkflow, "MERCHANDISE");
	assert.equal(rows.find(row => row.importKey === "check-in-2026-fri-1700")?.scannerWorkflow, "CHECK_IN");
	assert.equal(rows.find(row => row.importKey === "late-check-in-2026-fri-2030")?.scannerWorkflow, "CHECK_IN");
	assert.ok(rows.filter(row => row.type === "FOOD").every(row => row.scannerWorkflow === "FOOD"));
});
