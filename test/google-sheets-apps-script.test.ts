import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { z } from "zod";
import { provisioningBatchSchema } from "@/server/services/hacker-lifecycle";
import {
	applicationRow,
	appsScriptSource as source,
	createSheetHarness,
} from "@root/test/helpers/google-sheets-harness";

const operationalRecordSchema = z
	.object({
		id: z.string(),
		tShirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL", "NONE"]),
		mealCategory: z.enum(["STANDARD", "VEGETARIAN", "VEGAN", "HALAL", "OTHER"]),
		acceptanceExpiry: z.string().datetime(),
		walkIn: z.boolean(),
	})
	.strict();
const sheetCellSchema = z.union([z.string(), z.number(), z.boolean(), z.date()]);
const trackConfigSchema = z.object({
	baseUrl: z.string().url(),
	apiKey: z.string().min(1),
	deadline: z.string().datetime(),
});
const rsvpRecordSchema = z.object({
	id: z.string(),
	confirmed: z.boolean(),
	cancellationLink: z.string().optional(),
});
const reconciliationResponseSchema = z.object({
	records: z.array(rsvpRecordSchema),
	missingIds: z.array(z.string()),
});
const claimResponseSchema = z.object({ claimUrl: z.string().url(), expiresAt: z.string().datetime() });
const sheetAdapterSchema = z.object({
	applicationRowToOperationalRecord_: z
		.function()
		.args(
			z.array(z.string()),
			z.array(z.string()),
			z.string(),
			z.union([z.string(), z.date()]),
			z.boolean().optional(),
		)
		.returns(operationalRecordSchema),
	createParticipantId_: z.function().args().returns(z.string()),
	trackConfig_: z.function().args().returns(trackConfigSchema),
	claimDisplayUrl_: z.function().args(z.string()).returns(z.string().url()),
	operationalRecordFromRow_: z.function().args(z.array(sheetCellSchema)).returns(operationalRecordSchema),
	applyRsvpReconciliation_: z
		.function()
		.args(z.array(z.array(sheetCellSchema)), z.record(rsvpRecordSchema.nullable()), z.date())
		.returns(z.array(z.array(sheetCellSchema))),
	apiPost_: z
		.function()
		.args(
			trackConfigSchema,
			z.string(),
			z.union([
				operationalRecordSchema,
				z.object({ hackers: z.array(operationalRecordSchema) }),
				z.object({ ids: z.array(z.string()) }),
			]),
		)
		.returns(z.string()),
	processedResponse_: z
		.function()
		.args(z.string())
		.returns(z.object({ processed: z.number().int().nonnegative() })),
	rsvpReconciliationResponse_: z.function().args(z.string()).returns(reconciliationResponseSchema),
	claimResponse_: z.function().args(z.string()).returns(claimResponseSchema),
});

const sheetFetchOptionsSchema = z
	.object({
		method: z.literal("post"),
		contentType: z.literal("application/json"),
		headers: z.object({ Authorization: z.string().startsWith("Bearer ") }).strict(),
		payload: z.string(),
		muteHttpExceptions: z.literal(true),
	})
	.strict();
type SheetFetchOptions = z.infer<typeof sheetFetchOptionsSchema>;
const requests: Array<{ url: string; options: SheetFetchOptions }> = [];
const scriptProperties: Record<string, string> = {};
const adapter = sheetAdapterSchema.parse(
	runInNewContext(
		`${source}\n({
	applicationRowToOperationalRecord_,
	createParticipantId_,
	apiPost_,
	processedResponse_,
	rsvpReconciliationResponse_,
	claimResponse_,
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
				fetch: (url: string, options: unknown) => {
					requests.push({ url, options: sheetFetchOptionsSchema.parse(options) });
					return { getResponseCode: () => 200, getContentText: () => '{"processed":1}' };
				},
			},
		},
	),
);

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
		false,
	);

	assert.deepEqual(record, {
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

	assert.deepEqual(record, {
		id: "participant_abcdefghijklmnopqrstuvwxyz",
		tShirtSize: "S",
		mealCategory: "OTHER",
		acceptanceExpiry: "2026-09-01T07:59:59.000Z",
		walkIn: true,
	});
});

for (const [language, header, answer] of [
	["English", "What unisex T-shirt size would you prefer?", "I do not want a T-shirt"],
	["French", "Quelle taille de t-shirt unisexe préférez-vous?", "Je ne souhaite pas recevoir de t-shirt"],
] as const) {
	void test(`${language} T-shirt opt-outs survive batch acceptance and access-issuance row parsing`, () => {
		const applications = ["regular", "opt-out"].map(submissionId =>
			applicationRow({
				"Submission ID": submissionId,
				[header]: submissionId === "regular" ? "M" : answer,
				"Email address": "sheet-only@example.test",
				"Adresse courriel": "sheet-only@example.test",
			}),
		);
		const batches: Array<z.infer<typeof provisioningBatchSchema>> = [];
		const sheet = createSheetHarness({
			applications,
			fetch: ({ url, options }) => {
				assert.equal(url, "https://track.example/api/integrations/sheets/hackers");
				assert.doesNotMatch(options.payload, /sheet-only@example\.test/);
				const batch = provisioningBatchSchema.parse(JSON.parse(options.payload));
				batches.push(batch);
				return { status: 200, body: JSON.stringify({ processed: batch.hackers.length }) };
			},
		});
		sheet.run();
		assert.equal(batches.length, 1);
		assert.deepEqual(
			batches[0]?.hackers.map(record => record.tShirtSize),
			["M", "NONE"],
		);
		assert.deepEqual(sheet.alerts, ["2 participant(s) provisioned."]);
		const operations = sheet.savedRows();
		assert.equal(operations.length, 3);
		const savedOptOut = operations[2];
		assert.ok(savedOptOut);
		assert.equal(savedOptOut[0], "opt-out");
		assert.equal(adapter.operationalRecordFromRow_(savedOptOut).tShirtSize, "NONE");
	});
}

void test("unrecognized T-shirt answers are still rejected", () => {
	assert.throws(
		() =>
			adapter.applicationRowToOperationalRecord_(
				["What unisex T-shirt size would you prefer?"],
				["Undecided"],
				"participant_012345678901234567890123",
				"2026-09-30T03:59:59.000Z",
				false,
			),
		/Unsupported T-shirt size/,
	);
});

void test("the Sheet adapter generates opaque IDs and authenticates its API request", () => {
	const id = adapter.createParticipantId_();
	assert.equal(id.length, 64);
	assert.match(id, /^[A-Za-z0-9_-]+$/);
	assert.doesNotMatch(id, /^\d+$/);

	assert.deepEqual(
		adapter.processedResponse_(
			adapter.apiPost_(
				{
					baseUrl: "https://track.example",
					apiKey: "sheet-secret",
					deadline: "2026-09-01T03:59:59.000Z",
				},
				"/api/integrations/sheets/hackers",
				{
					hackers: [
						{
							id,
							tShirtSize: "M",
							mealCategory: "STANDARD",
							acceptanceExpiry: "2026-09-01T03:59:59.000Z",
							walkIn: false,
						},
					],
				},
			),
		),
		{ processed: 1 },
	);
	assert.deepEqual(requests.at(-1), {
		url: "https://track.example/api/integrations/sheets/hackers",
		options: {
			method: "post",
			contentType: "application/json",
			headers: { Authorization: "Bearer sheet-secret" },
			payload: JSON.stringify({
				hackers: [
					{
						id,
						tShirtSize: "M",
						mealCategory: "STANDARD",
						acceptanceExpiry: "2026-09-01T03:59:59.000Z",
						walkIn: false,
					},
				],
			}),
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
	assert.deepEqual(adapter.trackConfig_(), {
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

void test("the Sheet adapter rejects malformed API response bodies at its boundary", () => {
	assert.throws(() => adapter.processedResponse_('{"processed":"1"}'), /invalid processed response/);
	assert.throws(
		() => adapter.rsvpReconciliationResponse_('{"records":[{"id":1,"confirmed":true}],"missingIds":[]}'),
		/invalid RSVP reconciliation record/,
	);
	assert.throws(
		() => adapter.claimResponse_('{"claimUrl":"https://track.example/claim#token"}'),
		/invalid claim response/,
	);
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

	assert.deepEqual(adapter.operationalRecordFromRow_(operationRow), {
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
		adapter.applyRsvpReconciliation_(
			[blank, participant],
			{
				participant_1: {
					id: "participant_1",
					confirmed: true,
					cancellationLink: "https://track.example/cancel/token",
				},
			},
			now,
		),
		[
			Array.from({ length: 12 }, () => ""),
			["", "", "participant_1", "", "", "", "", "CONFIRMED", "https://track.example/cancel/token", "", now, ""],
		],
	);

	assert.throws(
		() => adapter.applyRsvpReconciliation_([participant], {}, now),
		/did not return a reconciliation result/,
	);
});
