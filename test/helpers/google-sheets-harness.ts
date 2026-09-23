import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { z } from "zod";

export const appsScriptSource = readFileSync(
	new URL("../../integrations/google-sheets/Code.gs", import.meta.url),
	"utf8",
);
export const applicationHeaders = z
	.array(z.string())
	.parse(JSON.parse(readFileSync(new URL("../fixtures/tally-application-headers.json", import.meta.url), "utf8")));
export const applicationRow = (values: Record<string, string>) =>
	applicationHeaders.map(header => values[header] ?? "");

export type SheetCell = string | number | boolean | Date;
export type SheetRows = SheetCell[][];
export type SheetRequest = {
	url: string;
	options: {
		method: "post";
		contentType: "application/json";
		headers: { Authorization: string };
		payload: string;
		muteHttpExceptions: true;
	};
};
export type SheetResponse = { status: number; body: string };
type MenuAction = "issuePassForSelectedRow";

const fetchOptionsSchema = z
	.object({
		method: z.literal("post"),
		contentType: z.literal("application/json"),
		headers: z.object({ Authorization: z.string() }).strict(),
		payload: z.string(),
		muteHttpExceptions: z.literal(true),
	})
	.strict();

// Model pending response-row writes separately from data visible to the next
// execution. Each menu run gets its own VM and lock handle.
export const createSheetHarness = (options: {
	applications: string[][];
	apiKey?: string;
	baseUrl?: string;
	fetch: (request: SheetRequest) => SheetResponse;
	beforeLock?: () => void;
	beforeFlush?: () => void;
	beforeWrite?: (row: number, values: SheetRows) => void;
}) => {
	let savedApplications: SheetRows = [structuredClone(applicationHeaders), ...structuredClone(options.applications)];
	let lockOwner: object | null = null;
	let uuidCalls = 0;
	const requests: SheetRequest[] = [];
	const properties: Record<string, string> = {
		TRACK_BASE_URL: options.baseUrl ?? "https://track.example",
		SHEETS_INTEGRATION_API_KEY: options.apiKey ?? "test-integration-key",
		RSVP_DEADLINE: "2030-09-30T03:59:59.000Z",
	};

	const run = (action: MenuAction = "issuePassForSelectedRow") => {
		const owner = {};
		let pendingApplications: SheetRows = [];
		const assertLocked = () => assert.equal(lockOwner, owner, "Operations must use the document lock");
		const applicationSheet = {
			getName: () => "Responses",
			setColumnWidth: () => assertLocked(),
			getLastRow: () => (pendingApplications.length ? pendingApplications : savedApplications).length,
			getLastColumn: () => (pendingApplications[0] ?? savedApplications[0])?.length ?? applicationHeaders.length,
			getActiveRange: () => ({
				getRow: () => 2,
				getLastRow: () => 2,
				getNumRows: () => 1,
			}),
			getRange: (row: number, column = 1, height = row === 1 ? 1 : options.applications.length, width = (pendingApplications[0] ?? savedApplications[0])?.length ?? applicationHeaders.length) => {
				const read = () => Array.from({ length: height }, (_, y) =>
					Array.from({ length: width }, (_, x) => (pendingApplications.length ? pendingApplications : savedApplications)[row - 1 + y]?.[column - 1 + x] ?? ""),
				);
				const write = (values: SheetRows) => {
					assertLocked();
					values.forEach((cells, y) => {
						const target = (pendingApplications[row - 1 + y] ??= []);
						cells.forEach((value, x) => { target[column - 1 + x] = value; });
					});
				};
				return { getValues: read, getDisplayValues: () => read().map(cells => cells.map(String)), setValues: write, setValue: (value: SheetCell) => write([[value]]) };
			},
		};
		runInNewContext(`${appsScriptSource}\n${action}()`, {
			Date,
			Utilities: {
				getUuid: () => {
					uuidCalls += 1;
					return randomUUID();
				},
			},
			PropertiesService: { getScriptProperties: () => ({ getProperty: (name: string) => properties[name] }) },
			LockService: {
				getDocumentLock: () => ({
					tryLock: (timeout: number) => {
						assert.equal(timeout, 30000);
						options.beforeLock?.();
						if (lockOwner) return false;
						lockOwner = owner;
						pendingApplications = structuredClone(savedApplications);
						return true;
					},
					releaseLock: () => {
						assertLocked();
						lockOwner = null;
					},
				}),
			},
			SpreadsheetApp: {
				getActiveSheet: () => applicationSheet,
				flush: () => {
					assertLocked();
					options.beforeFlush?.();
					savedApplications = structuredClone(pendingApplications);
				},
			},
			UrlFetchApp: {
				fetch: (url: string, input: unknown) => {
					assertLocked();
					const request = { url, options: fetchOptionsSchema.parse(input) };
					requests.push(request);
					const response = options.fetch(request);
					return { getResponseCode: () => response.status, getContentText: () => response.body };
				},
			},
		});
	};
	return {
		run,
		requests,
		savedApplications: () => structuredClone(savedApplications),
		uuidCalls: () => uuidCalls,
	};
};

export const responseHeaders = [
	"Participant ID", "T-Shirt Size", "Meal Category", "RSVP Deadline", "RSVP Link",
	"RSVP Status", "Cancellation Link", "Pass Expires", "Last Sync", "Walk-In", "RSVP Refreshed At",
];

export const createResponseHarness = (options: {
	applications: string[][];
	operational?: SheetRows;
	apiKey?: string;
	baseUrl?: string;
	fetch: (request: SheetRequest) => SheetResponse;
	testSubmissionId?: string;
	beforeWrite?: (row: number, column: number) => void;
}) => {
	let saved: SheetRows = [
		[...applicationHeaders, ...responseHeaders],
		...options.applications.map((row, index) => [...row, ...responseHeaders.map((_, field) => options.operational?.[index]?.[field] ?? "")]),
	];
	let pending: SheetRows = [];
	let locked = false;
	const requests: SheetRequest[] = [];
	const toasts: Array<{ message: string; title: string; timeout: number }> = [];
	const getCell = (row: number, column: number) => pending[row - 1]?.[column - 1] ?? "";
	const sheet = {
		getName: () => "Responses",
		getLastRow: () => pending.length,
		getLastColumn: () => pending[0]?.length ?? 0,
		getMaxColumns: () => pending[0]?.length ?? 0,
		insertColumnsAfter: () => { throw new Error("Unexpected column insertion"); },
		getActiveRange: () => { throw new Error("Bulk preparation must not use the highlighted selection"); },
		getRange: (row: number, column: number, height = 1, width = 1) => {
			const read = () => Array.from({ length: height }, (_, y) =>
				Array.from({ length: width }, (_, x) => getCell(row + y, column + x)));
			const write = (values: SheetRows) => {
				assert.equal(locked, true);
				options.beforeWrite?.(row, column);
				values.forEach((cells, y) => cells.forEach((value, x) => {
					(pending[row - 1 + y] ??= [])[column - 1 + x] = value;
				}));
			};
			return { getValues: read, getDisplayValues: () => read().map(cells => cells.map(String)), setValues: write, setValue: (value: SheetCell) => write([[value]]) };
		},
	};
	const run = (action: "reviewAcceptedRowsForRsvp" | "prepareAcceptedRowsForRsvp" | "prepareAcceptedRowsForRsvpFromMenu" | "prepareTestSubmissionForRsvp" | "reviewExistingDietaryCategories" | "reconcileExistingDietaryCategories" | "refreshResponseRsvpStatus" | "refreshResponseRsvpStatusFromMenu") => {
		pending = structuredClone(saved);
		const properties: Record<string, string | undefined> = {
			TRACK_BASE_URL: options.baseUrl ?? "https://track.example",
			SHEETS_INTEGRATION_API_KEY: options.apiKey ?? "test-key",
			RSVP_DEADLINE: "2030-09-30T03:59:59.000Z",
			TRACK_TEST_SUBMISSION_ID: options.testSubmissionId,
		};
		const result: unknown = runInNewContext(`${appsScriptSource}\n${action}()`, {
			Date,
			Utilities: { getUuid: () => randomUUID() },
			PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties[key] }) },
			LockService: { getDocumentLock: () => ({ tryLock: () => { locked = true; return true; }, releaseLock: () => { locked = false; } }) },
			SpreadsheetApp: {
				getActiveSheet: () => sheet,
				getActive: () => ({
					toast: (message: string, title: string, timeout: number) => toasts.push({ message, title, timeout }),
				}),
				flush: () => { assert.equal(locked, true); saved = structuredClone(pending); },
			},
			UrlFetchApp: { fetch: (url: string, input: unknown) => {
				assert.equal(locked, true);
				const request = { url, options: fetchOptionsSchema.parse(input) };
				requests.push(request);
				const response = options.fetch(request);
				return { getResponseCode: () => response.status, getContentText: () => response.body };
			} },
		});
		return structuredClone(result);
	};
	return { run, requests, rows: () => structuredClone(saved), locked: () => locked, toasts: () => structuredClone(toasts) };
};
