import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { applicationHeaders, applicationRow, appsScriptSource } from "@root/test/helpers/google-sheets-harness";

const legacyHeaders = [
	"Track Participant ID", "Track RSVP Link", "Track RSVP Status",
	"Track Cancellation Link", "Track Access Expires", "Track Last Sync",
];

const migrate = (headers = legacyHeaders) => {
	const cells: Array<Array<string | number | boolean | Date>> = [
		[...applicationHeaders, ...headers],
		[...applicationRow({ "Submission ID": "test", "Admission status": "Accepted" }), "stable-id", "https://track.example/rsvp/stable-id", "CONFIRMED", "https://track.example/cancel#legacy", "expiry", "sync"],
	];
	let maxColumns = cells[0]?.length ?? 0;
	let writes = 0;
	let locked = false;
	const sheet = {
		getName: () => "Responses",
		getLastColumn: () => cells[0]?.length ?? 0,
		getLastRow: () => cells.length,
		getMaxColumns: () => maxColumns,
		insertColumnsAfter: (_column: number, count: number) => { maxColumns += count; },
		getRange: (row: number, column: number, height = 1, width = 1) => {
			const read = () => Array.from({ length: height }, (_, y) =>
				Array.from({ length: width }, (_, x) => cells[row - 1 + y]?.[column - 1 + x] ?? ""));
			return {
				getValues: read,
				getDisplayValues: () => read().map(values => values.map(String)),
				setValues: (values: Array<Array<string | number | boolean | Date>>) => {
					writes++;
					values.forEach((valuesRow, y) => valuesRow.forEach((value, x) => { (cells[row - 1 + y] ??= [])[column - 1 + x] = value; }));
				},
			};
		},
	};
	const execute = (): unknown => {
		const result: unknown = runInNewContext(`${appsScriptSource}\nmigrateLegacyResponseColumnsForRsvp()`, {
			SpreadsheetApp: { getActiveSheet: () => sheet, flush: () => undefined },
			LockService: { getDocumentLock: () => ({ tryLock: () => { locked = true; return true; }, releaseLock: () => { locked = false; } }) },
		});
		return result;
	};
	return { execute, cells, writes: () => writes, locked: () => locked };
};

void test("explicit six-column migration preserves IDs and old links while adding RSVP fields", () => {
	const sheet = migrate();
	assert.equal(sheet.execute(), 1);
	assert.equal(sheet.writes(), 1);
	assert.equal(sheet.locked(), false);
	const headers = sheet.cells[0];
	const data = sheet.cells[1];
	const start = applicationHeaders.length;
	assert.equal(headers?.[start], "Participant ID");
	assert.equal(headers?.[start + 9], "Walk-In");
	assert.equal(data?.[start], "stable-id");
	assert.equal(data?.[start + 4], "https://track.example/rsvp/stable-id");
	assert.equal(data?.[start + 5], "CONFIRMED");
	assert.equal(data?.[start + 6], "https://track.example/cancel#legacy");
	assert.equal(data?.[start + 7], "expiry");
	assert.equal(data?.[start + 8], "sync");
});

void test("migration refuses an unknown header layout before changing any data", () => {
	const sheet = migrate([...legacyHeaders.slice(0, 5), "Other"]);
	assert.throws(sheet.execute, /exact final columns/);
	assert.equal(sheet.writes(), 0);
	assert.equal(sheet.locked(), false);
});
