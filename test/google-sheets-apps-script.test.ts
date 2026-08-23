import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

type SheetAdapter = {
	applicationRowToOperationalRecord_: (
		headers: string[],
		row: string[],
		participantId: string,
		acceptanceExpiry: string,
		walkIn?: boolean,
	) => Record<string, unknown>;
	createParticipantId_: () => string;
	trackConfig_: () => { baseUrl: string; apiKey: string; deadline: string };
	claimDisplayUrl_: (claimUrl: unknown) => string;
	operationalRecordFromRow_: (row: unknown[]) => Record<string, unknown>;
	applyRsvpReconciliation_: (
		rows: unknown[][],
		byId: Record<string, { confirmed: boolean; cancellationLink?: string } | null>,
		now: Date,
	) => unknown[][];
	apiPost_: (config: { baseUrl: string; apiKey: string }, path: string, payload: unknown) => Record<string, unknown>;
};

const source = readFileSync(new URL("../integrations/google-sheets/Code.gs", import.meta.url), "utf8");
const requests: Array<{ url: string; options: Record<string, unknown> }> = [];
const scriptProperties: Record<string, string> = {};
const adapter = runInNewContext(
	`${source}\n({
	applicationRowToOperationalRecord_,
	createParticipantId_,
	apiPost_,
	trackConfig_,
	claimDisplayUrl_,
	operationalRecordFromRow_,
	applyRsvpReconciliation_,
})`,
	{
		Utilities: {
			getUuid: () => "123e4567-e89b-42d3-a456-426614174000",
		},
		PropertiesService: {
			getScriptProperties: () => ({ getProperty: (name: string) => scriptProperties[name] }),
		},
		UrlFetchApp: {
			fetch: (url: string, options: Record<string, unknown>) => {
				requests.push({ url, options });
				return { getResponseCode: () => 200, getContentText: () => '{"processed":1}' };
			},
		},
	},
) as SheetAdapter;

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

void test("the real Sheet adapter maps the live English headers to an allow-listed record", () => {
	const headers = [
		"Submission ID",
		"Email address",
		"What unisex T-shirt size would you prefer?",
		"Select all that apply.",
		"Select all that apply. (Halal)",
	];
	const record = adapter.applicationRowToOperationalRecord_(
		headers,
		["tally-secret", "private@example.test", "XL", "Vegan", "FALSE"],
		"participant_012345678901234567890123",
		"2026-09-01T03:59:59.000Z",
	);

	assert.deepEqual(plain(record), {
		id: "participant_012345678901234567890123",
		tShirtSize: "XL",
		mealCategory: "VEGAN",
		acceptanceExpiry: "2026-09-01T03:59:59.000Z",
		walkIn: false,
	});
	assert.doesNotMatch(JSON.stringify(record), /tally-secret|private@example.test/);
});

void test("the real Sheet adapter maps the live French headers and detailed restrictions safely", () => {
	const record = adapter.applicationRowToOperationalRecord_(
		[
			"Quelle taille de t-shirt unisexe préférez-vous?",
			"Si vous avez des restrictions alimentaires ou des allergies, sélectionnez-les ci-dessous:",
		],
		["S", "Allergie au blé"],
		"participant_abcdefghijklmnopqrstuvwxyz",
		"2026-09-01T03:59:59-04:00",
		true,
	);

	assert.deepEqual(plain(record), {
		id: "participant_abcdefghijklmnopqrstuvwxyz",
		tShirtSize: "S",
		mealCategory: "OTHER",
		acceptanceExpiry: "2026-09-01T07:59:59.000Z",
		walkIn: true,
	});
});

void test("the Sheet adapter generates opaque IDs and authenticates its API request", () => {
	const id = adapter.createParticipantId_();
	assert.equal(id.length, 64);
	assert.match(id, /^[A-Za-z0-9_-]+$/);
	assert.doesNotMatch(id, /^\d+$/);

	assert.deepEqual(
		plain(
			adapter.apiPost_(
				{ baseUrl: "https://track.example", apiKey: "sheet-secret" },
				"/api/integrations/sheets/hackers",
				{ hackers: [{ id }] },
			),
		),
		{ processed: 1 },
	);
	assert.deepEqual(plain(requests.at(-1)), {
		url: "https://track.example/api/integrations/sheets/hackers",
		options: {
			method: "post",
			contentType: "application/json",
			headers: { Authorization: "Bearer sheet-secret" },
			payload: JSON.stringify({ hackers: [{ id }] }),
			muteHttpExceptions: true,
		},
	});
});

void test("the Sheet adapter requires HTTPS configuration and validates claim links", () => {
	Object.assign(scriptProperties, {
		TRACK_BASE_URL: "http://track.example",
		SHEETS_INTEGRATION_API_KEY: "sheet-secret",
		RSVP_DEADLINE: "2026-09-01T03:59:59.000Z",
	});
	assert.throws(() => adapter.trackConfig_(), /HTTPS TRACK_BASE_URL/);

	scriptProperties.TRACK_BASE_URL = "https://track.example/";
	assert.deepEqual(plain(adapter.trackConfig_()), {
		baseUrl: "https://track.example",
		apiKey: "sheet-secret",
		deadline: "2026-09-01T03:59:59.000Z",
	});
	assert.equal(
		adapter.claimDisplayUrl_("https://track.example/claim#secret-token"),
		"https://track.example/claim/qr#secret-token",
	);
	assert.throws(() => adapter.claimDisplayUrl_("http://track.example/claim#secret-token"), /invalid claim URL/);
	assert.throws(() => adapter.claimDisplayUrl_("https://track.example/claim/secret-token"), /invalid claim URL/);
});

void test("the operations row preserves walk-in status when access is issued", () => {
	const operationRow = [
		"tally-submission",
		2,
		"participant_walk_in",
		"L",
		"STANDARD",
		"2026-09-01T03:59:59.000Z",
		"https://track.example/rsvp/participant_walk_in",
		"PENDING",
		"",
		"",
		"2026-08-23T12:00:00.000Z",
		true,
	];

	assert.deepEqual(plain(adapter.operationalRecordFromRow_(operationRow)), {
		id: "participant_walk_in",
		tShirtSize: "L",
		mealCategory: "STANDARD",
		acceptanceExpiry: "2026-09-01T03:59:59.000Z",
		walkIn: true,
	});
});

void test("the operations tab safely adds the walk-in column to the previous schema", () => {
	const previousHeaders = [
		"Source Submission ID",
		"Source Row",
		"Participant ID",
		"T-Shirt Size",
		"Meal Category",
		"Acceptance Expires",
		"RSVP Link",
		"RSVP Status",
		"Cancellation Link",
		"Access Expires",
		"Last Sync",
	];
	let addedHeader = "";
	const sheet = {
		getRange: (...coordinates: number[]) =>
			coordinates.length === 4
				? { getDisplayValues: () => [[...previousHeaders, ""]] }
				: { setValue: (value: string) => (addedHeader = value) },
	};

	runInNewContext(`${source}\nensureOperationsSheet_()`, {
		SpreadsheetApp: {
			getActive: () => ({ getSheetByName: () => sheet }),
		},
	});
	assert.equal(addedHeader, "Walk-In");
});

void test("reconciliation skips blank operation rows and rejects incomplete API results", () => {
	const blank = Array.from({ length: 12 }, () => "");
	const participant = Array.from({ length: 12 }, () => "");
	participant[2] = "participant_1";
	const now = new Date("2026-08-23T12:00:00.000Z");

	assert.deepEqual(
		plain(
			adapter.applyRsvpReconciliation_(
				[blank, participant],
				{ participant_1: { confirmed: true, cancellationLink: "https://track.example/cancel/token" } },
				now,
			),
		),
		[
			Array.from({ length: 12 }, () => ""),
			[
				"",
				"",
				"participant_1",
				"",
				"",
				"",
				"",
				"CONFIRMED",
				"https://track.example/cancel/token",
				"",
				"2026-08-23T12:00:00.000Z",
				"",
			],
		],
	);

	assert.throws(
		() => adapter.applyRsvpReconciliation_([participant], {}, now),
		/did not return a reconciliation result/,
	);
});
