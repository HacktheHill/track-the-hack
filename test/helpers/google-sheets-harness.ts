import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { z } from "zod";

export const appsScriptSource = readFileSync(
	new URL("../../integrations/google-sheets/Code.gs", import.meta.url),
	"utf8",
);
export const sidebarSource = readFileSync(
	new URL("../../integrations/google-sheets/Sidebar.html", import.meta.url),
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
		headers: {
			Authorization: string;
			"CF-Access-Client-Id": string;
			"CF-Access-Client-Secret": string;
		};
		payload: string;
		muteHttpExceptions: true;
	};
};
export type SheetResponse = { status: number; body: string };

const fetchOptionsSchema = z
	.object({
		method: z.literal("post"),
		contentType: z.literal("application/json"),
		headers: z
			.object({
				Authorization: z.string(),
				"CF-Access-Client-Id": z.string(),
				"CF-Access-Client-Secret": z.string(),
			})
			.strict(),
		payload: z.string(),
		muteHttpExceptions: z.literal(true),
	})
	.strict();
const claimDisplaySchema = z.object({
	displayUrl: z.string().url(),
	expiresAt: z.string().datetime(),
	rowNumber: z.number().int().positive(),
	rsvpStatus: z.string(),
	warning: z.string(),
});

export const createSheetHarness = (options: {
	applications: string[][];
	fetch: (request: SheetRequest) => SheetResponse;
	apiKey?: string;
	baseUrl?: string;
	accessClientId?: string;
	accessClientSecret?: string;
	initialHeaders?: string[];
	maxColumns?: number;
	selectedRow?: number;
	selectedRows?: number;
	sheetName?: string;
	beforeFlush?: () => void;
}) => {
	let savedRows: SheetRows = [
		structuredClone(options.initialHeaders ?? applicationHeaders),
		...structuredClone(options.applications),
	];
	let maxColumns = options.maxColumns ?? savedRows[0]?.length ?? 0;
	let lockOwner: object | null = null;
	let pendingRows: SheetRows = [];
	let uuidCalls = 0;
	const requests: SheetRequest[] = [];
	const properties: Record<string, string> = {
		TRACK_BASE_URL: options.baseUrl ?? "https://track.example",
		SHEETS_INTEGRATION_API_KEY: options.apiKey ?? "test-integration-key",
		RSVP_DEADLINE: "2030-09-30T03:59:59.000Z",
		CF_ACCESS_CLIENT_ID: options.accessClientId ?? "test-access-client",
		CF_ACCESS_CLIENT_SECRET: options.accessClientSecret ?? "test-access-secret",
	};

	const owner = {};
	const assertLocked = () => assert.equal(lockOwner, owner, "Sheet operations must use the document lock");
	const sheet = {
		getName: () => options.sheetName ?? "Responses",
		getLastColumn: () => {
			assertLocked();
			return pendingRows[0]?.length ?? 0;
		},
		getMaxColumns: () => {
			assertLocked();
			return maxColumns;
		},
		insertColumnsAfter: (after: number, count: number) => {
			assertLocked();
			assert.equal(after, maxColumns);
			maxColumns += count;
		},
		getActiveRange: () => ({
			getRow: () => options.selectedRow ?? 2,
			getNumRows: () => options.selectedRows ?? 1,
		}),
		getRange: (row: number, column: number, height = 1, width = 1) => {
			const read = () => {
				assertLocked();
				return Array.from({ length: height }, (_, y) =>
					Array.from({ length: width }, (_, x) => pendingRows[row - 1 + y]?.[column - 1 + x] ?? ""),
				);
			};
			const write = (values: SheetRows) => {
				assertLocked();
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

	const run = () =>
		claimDisplaySchema.parse(
			runInNewContext(`${appsScriptSource}\nprovisionSelectedParticipantAndIssueAccess()`, {
				Date,
				Map,
				Utilities: {
					getUuid: () => {
						uuidCalls += 1;
						return randomUUID();
					},
				},
				PropertiesService: {
					getScriptProperties: () => ({ getProperty: (name: string) => properties[name] }),
				},
				LockService: {
					getDocumentLock: () => ({
						tryLock: (timeout: number) => {
							assert.equal(timeout, 30000);
							if (lockOwner) return false;
							lockOwner = owner;
							pendingRows = structuredClone(savedRows);
							return true;
						},
						releaseLock: () => {
							assertLocked();
							lockOwner = null;
						},
					}),
				},
				SpreadsheetApp: {
					getActiveSheet: () => sheet,
					flush: () => {
						assertLocked();
						options.beforeFlush?.();
						savedRows = structuredClone(pendingRows);
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
			}),
		);

	return {
		run,
		requests,
		properties,
		savedRows: () => structuredClone(savedRows),
		isLocked: () => lockOwner !== null,
		uuidCalls: () => uuidCalls,
		maxColumns: () => maxColumns,
	};
};
