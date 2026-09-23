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
	const selectedRange = { a1Notation: "252:252" };
	let restoredRange: unknown;
	const columnWidths = new Map<number, number>();
	const sheet = {
		getName: () => "Responses",
		getActiveRange: () => selectedRange,
		setActiveRange: (range: unknown) => { restoredRange = range; },
		setColumnWidth: (column: number, width: number) => { columnWidths.set(column, width); },
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
				setValue: (value: string | number | boolean | Date) => {
					writes++;
					(cells[row - 1] ??= [])[column - 1] = value;
				},
			};
		},
	};
	const execute = (action = "migrateLegacyResponseColumnsForRsvp"): unknown => {
		const result: unknown = runInNewContext(`${appsScriptSource}\n${action}()`, {
			SpreadsheetApp: { getActiveSheet: () => sheet, flush: () => undefined },
			LockService: { getDocumentLock: () => ({ tryLock: () => { locked = true; return true; }, releaseLock: () => { locked = false; } }) },
		});
		return result;
	};
	return {
		execute,
		cells,
		writes: () => writes,
		locked: () => locked,
		selectedRange,
		restoredRange: () => restoredRange,
		columnWidths,
	};
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
	assert.equal(headers?.[start + 10], "RSVP Refreshed At");
	assert.equal(data?.[start], "stable-id");
	assert.equal(data?.[start + 4], "https://track.example/rsvp/stable-id");
	assert.equal(data?.[start + 5], "CONFIRMED");
	assert.equal(data?.[start + 6], "https://track.example/cancel#legacy");
	assert.equal(data?.[start + 7], "expiry");
	assert.equal(data?.[start + 8], "sync");
	assert.equal(data?.[start + 10], "");
	assert.equal(sheet.restoredRange(), sheet.selectedRange);
	assert.deepEqual(
		[...sheet.columnWidths.entries()],
		[
			[start + 1, 260], [start + 2, 110], [start + 3, 130], [start + 4, 175],
			[start + 5, 300], [start + 6, 120], [start + 7, 300], [start + 8, 175],
			[start + 9, 175], [start + 10, 90], [start + 11, 175],
		],
	);
});

void test("migration refuses an unknown header layout before changing any data", () => {
	const sheet = migrate([...legacyHeaders.slice(0, 5), "Other"]);
	assert.throws(sheet.execute, /exact final columns/);
	assert.equal(sheet.writes(), 0);
	assert.equal(sheet.locked(), false);
});

void test("an already migrated ten-column response layout gains only the refresh timestamp", () => {
	const tenHeaders = [
		"Participant ID", "T-Shirt Size", "Meal Category", "RSVP Deadline", "RSVP Link",
		"RSVP Status", "Cancellation Link", "Pass Expires", "Last Sync", "Walk-In",
	];
	const sheet = migrate(tenHeaders);
	assert.equal(sheet.execute("migrateResponseRsvpRefreshColumn"), 1);
	assert.equal(sheet.cells[0]?.[applicationHeaders.length + 10], "RSVP Refreshed At");
	assert.equal(sheet.cells[1]?.[applicationHeaders.length], "stable-id");
	assert.equal(sheet.writes(), 1);
	assert.equal(sheet.restoredRange(), sheet.selectedRange);
	assert.equal(sheet.columnWidths.get(applicationHeaders.length + 11), 175);
});

void test("the refresh-column migration is idempotent after the header exists", () => {
	const elevenHeaders = [
		"Participant ID", "T-Shirt Size", "Meal Category", "RSVP Deadline", "RSVP Link",
		"RSVP Status", "Cancellation Link", "Pass Expires", "Last Sync", "Walk-In", "RSVP Refreshed At",
	];
	const sheet = migrate(elevenHeaders);
	assert.equal(sheet.execute("migrateResponseRsvpRefreshColumn"), 1);
	assert.equal(sheet.writes(), 0);
});
