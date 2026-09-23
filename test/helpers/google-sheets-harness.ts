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
type MenuAction =
	| "acceptSelectedApplications"
	| "issuePassForSelectedRow"
	| "prepareSelectedRowsForRsvp"
	| "refreshResponseRsvpStatus"
	| "acceptSelectedWalkInApplications"
	| "refreshRsvpStatus"
	| "setupTrackOperations"
	| "issueAccessForSelectedParticipant";

const fetchOptionsSchema = z
	.object({
		method: z.literal("post"),
		contentType: z.literal("application/json"),
		headers: z.object({ Authorization: z.string() }).strict(),
		payload: z.string(),
		muteHttpExceptions: z.literal(true),
	})
	.strict();

// Model pending Sheet writes separately from data visible to the next execution.
// Each menu run gets its own VM and lock handle, sharing only the saved Sheet.
export const createSheetHarness = (options: {
	applications: string[][];
	apiKey?: string;
	baseUrl?: string;
	fetch: (request: SheetRequest) => SheetResponse;
	beforeLock?: () => void;
	beforeFlush?: () => void;
	beforeWrite?: (row: number, values: SheetRows) => void;
	initialRows?: SheetRows;
}) => {
	let savedRows: SheetRows = structuredClone(options.initialRows ?? []);
	let savedApplications: SheetRows = [structuredClone(applicationHeaders), ...structuredClone(options.applications)];
	let lockOwner: object | null = null;
	let uuidCalls = 0;
	const requests: SheetRequest[] = [];
	const alerts: string[] = [];
	const properties: Record<string, string> = {
		TRACK_BASE_URL: options.baseUrl ?? "https://track.example",
		SHEETS_INTEGRATION_API_KEY: options.apiKey ?? "test-integration-key",
		RSVP_DEADLINE: "2030-09-30T03:59:59.000Z",
	};

	const run = (action: MenuAction = "acceptSelectedApplications") => {
		const owner = {};
		let pendingRows: SheetRows = [];
		let pendingApplications: SheetRows = [];
		const assertLocked = () => assert.equal(lockOwner, owner, "Operations must use the document lock");
		const sheet = {
			getName: () => "Track Operations",
			getLastRow: () => {
				assertLocked();
				return pendingRows.length;
			},
			setFrozenRows: () => assertLocked(),
			getActiveRange: () => ({ getRow: () => 2, getNumRows: () => 1 }),
			getRange: (row: number, column: number, height = 1, width = 1) => {
				const read = () => {
					assertLocked();
					return Array.from({ length: height }, (_, y) =>
						Array.from({ length: width }, (_, x) => pendingRows[row - 1 + y]?.[column - 1 + x] ?? ""),
					);
				};
				const write = (values: SheetRows) => {
					assertLocked();
					options.beforeWrite?.(row, values);
					values.forEach((cells, y) => {
						const target = (pendingRows[row - 1 + y] ??= []);
						cells.forEach((value, x) => {
							target[column - 1 + x] = value;
						});
					});
				};
				return {
					getValues: read,
					getDisplayValues: () => read().map(cells => cells.map(String)),
					setValues: write,
					setValue: (value: SheetCell) => write([[value]]),
				};
			},
		};
		const applicationSheet = {
			getName: () => "Applications",
			getLastRow: () => (pendingApplications.length ? pendingApplications : savedApplications).length,
			getLastColumn: () => (pendingApplications[0] ?? savedApplications[0])?.length ?? applicationHeaders.length,
			getActiveRange: () => ({
				getRow: () => 2,
				getLastRow: () => action === "issuePassForSelectedRow" ? 2 : options.applications.length + 1,
				getNumRows: () => action === "issuePassForSelectedRow" ? 1 : options.applications.length,
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
		const html = { setWidth: () => html, setHeight: () => html };
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
						pendingRows = structuredClone(savedRows);
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
				getActive: () => ({ getSheetByName: () => sheet, setActiveSheet: () => undefined }),
				getActiveSheet: () => (action === "issueAccessForSelectedParticipant" ? sheet : applicationSheet),
				flush: () => {
					assertLocked();
					options.beforeFlush?.();
					savedRows = structuredClone(pendingRows);
					savedApplications = structuredClone(pendingApplications);
				},
				getUi: () => ({
					alert: (message: string) => {
						assert.equal(lockOwner, null);
						alerts.push(message);
					},
					showModalDialog: () => assert.equal(lockOwner, null),
				}),
			},
			HtmlService: { createHtmlOutput: () => html },
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
		alerts,
		savedRows: () => structuredClone(savedRows),
		savedApplications: () => structuredClone(savedApplications),
		isLocked: () => lockOwner !== null,
		uuidCalls: () => uuidCalls,
	};
};
