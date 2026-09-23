import assert from "node:assert/strict";
import test from "node:test";
import { provisioningRecordSchema, reconciliationRequestSchema } from "@/server/services/hacker-lifecycle";
import {
	applicationHeaders,
	applicationRow,
	createSheetHarness,
	type SheetRequest,
} from "@root/test/helpers/google-sheets-harness";

const acceptedApplication = (overrides: Record<string, string> = {}) =>
	applicationRow({
		"Submission ID": "test-submission",
		"Admission status": "Accepted",
		"What unisex T-shirt size would you prefer?": "M",
		...overrides,
	});

const claimResponse = {
	claimUrl: "https://track.example/claim#single-use-token",
	expiresAt: "2030-09-15T00:05:00.000Z",
};
const displayUrl = `https://track.example/claim/qr?expiresAt=${encodeURIComponent(claimResponse.expiresAt)}#single-use-token`;

const headerValue = (rows: Array<Array<string | number | boolean | Date>>, row: number, header: string) => {
	const index = rows[0]?.indexOf(header) ?? -1;
	assert.notEqual(index, -1, `Missing ${header}`);
	return rows[row]?.[index];
};

const successfulFetch = (request: SheetRequest) => {
	if (request.url.endsWith("/claim")) {
		provisioningRecordSchema.parse(JSON.parse(request.options.payload));
		return { status: 200, body: JSON.stringify(claimResponse) };
	}
	const { ids } = reconciliationRequestSchema.parse(JSON.parse(request.options.payload));
	return {
		status: 200,
		body: JSON.stringify({ records: ids.map(id => ({ id, confirmed: false })), missingIds: [] }),
	};
};

void test("one action provisions an accepted response, issues its QR, and reconciles RSVP state", () => {
	const sheet = createSheetHarness({
		applications: [acceptedApplication()],
		fetch: request => {
			assert.deepEqual(request.options.headers, {
				Authorization: "Bearer test-integration-key",
				"CF-Access-Client-Id": "test-access-client",
				"CF-Access-Client-Secret": "test-access-secret",
			});
			if (request.url.endsWith("/claim")) {
				const record = provisioningRecordSchema.parse(JSON.parse(request.options.payload));
				assert.equal(record.walkIn, false);
				assert.equal(record.tShirtSize, "M");
				return { status: 200, body: JSON.stringify(claimResponse) };
			}
			const { ids } = reconciliationRequestSchema.parse(JSON.parse(request.options.payload));
			return {
				status: 200,
				body: JSON.stringify({
					records: [
						{
							id: ids[0],
							confirmed: true,
							cancellationLink: "https://track.example/cancel#capability",
						},
					],
					missingIds: [],
				}),
			};
		},
	});

	const result = sheet.run();
	assert.equal(result.displayUrl, displayUrl);
	assert.equal(result.rowNumber, 2);
	assert.equal(result.rsvpStatus, "CONFIRMED");
	assert.equal(result.warning, "");
	assert.deepEqual(sheet.savedRows()[0]?.slice(applicationHeaders.length), [
		"Track Participant ID",
		"Track RSVP Link",
		"Track RSVP Status",
		"Track Cancellation Link",
		"Track Access Expires",
		"Track Last Sync",
	]);
	assert.equal(headerValue(sheet.savedRows(), 1, "Track RSVP Status"), "CONFIRMED");
	assert.equal(
		headerValue(sheet.savedRows(), 1, "Track Cancellation Link"),
		"https://track.example/cancel#capability",
	);
	assert.deepEqual(headerValue(sheet.savedRows(), 1, "Track Access Expires"), new Date(claimResponse.expiresAt));
	assert.ok(headerValue(sheet.savedRows(), 1, "Track Last Sync") instanceof Date);
	assert.equal(sheet.maxColumns(), applicationHeaders.length + 6);
	assert.equal(sheet.isLocked(), false);
});

void test("a failed claim keeps the committed participant ID and retry reuses it", () => {
	let claimAttempts = 0;
	const claimIds: string[] = [];
	const sheet = createSheetHarness({
		applications: [acceptedApplication()],
		fetch: request => {
			if (request.url.endsWith("/claim")) {
				const record = provisioningRecordSchema.parse(JSON.parse(request.options.payload));
				claimIds.push(record.id);
				claimAttempts += 1;
				if (claimAttempts === 1) throw new Error("Lost response");
			}
			return successfulFetch(request);
		},
	});

	assert.throws(() => sheet.run(), /Lost response/);
	const savedId = String(headerValue(sheet.savedRows(), 1, "Track Participant ID"));
	assert.ok(savedId);
	const result = sheet.run();
	assert.equal(result.displayUrl, displayUrl);
	assert.deepEqual(claimIds, [savedId, savedId]);
	assert.equal(sheet.uuidCalls(), 2);
	assert.equal(sheet.isLocked(), false);
});

for (const status of ["Waitlisted", "Excluded (member)", ""] as const) {
	void test(`access is refused when Admission status is ${status || "blank"}`, () => {
		const sheet = createSheetHarness({
			applications: [acceptedApplication({ "Admission status": status })],
			fetch: successfulFetch,
		});
		assert.throws(() => sheet.run(), status ? /is not accepted/ : /Missing required Sheet value: Admission status/);
		assert.equal(sheet.requests.length, 0);
		assert.equal(headerValue(sheet.savedRows(), 1, "Track Participant ID") ?? "", "");
	});
}

void test("a QR remains available when the follow-up RSVP refresh fails", () => {
	const sheet = createSheetHarness({
		applications: [acceptedApplication()],
		fetch: request =>
			request.url.endsWith("/claim")
				? { status: 200, body: JSON.stringify(claimResponse) }
				: { status: 503, body: "reconciliation unavailable" },
	});
	const result = sheet.run();
	assert.equal(result.displayUrl, displayUrl);
	assert.match(result.warning, /RSVP status could not be refreshed/);
	assert.deepEqual(headerValue(sheet.savedRows(), 1, "Track Access Expires"), new Date(claimResponse.expiresAt));
});

void test("existing Track columns and participant IDs are reused by header name", () => {
	const headers = [...applicationHeaders, "Track Participant ID", "Track RSVP Status"];
	const row = [...acceptedApplication(), "participant_existing_0123456789", "CONFIRMED"];
	const sheet = createSheetHarness({
		applications: [row],
		initialHeaders: headers,
		maxColumns: headers.length,
		fetch: request => {
			if (request.url.endsWith("/claim")) {
				assert.equal(
					provisioningRecordSchema.parse(JSON.parse(request.options.payload)).id,
					"participant_existing_0123456789",
				);
			}
			return successfulFetch(request);
		},
	});
	sheet.run();
	assert.equal(headerValue(sheet.savedRows(), 1, "Track Participant ID"), "participant_existing_0123456789");
	assert.equal(sheet.uuidCalls(), 0);
	for (const header of [
		"Track Participant ID",
		"Track RSVP Link",
		"Track RSVP Status",
		"Track Cancellation Link",
		"Track Access Expires",
		"Track Last Sync",
	]) {
		assert.equal(sheet.savedRows()[0]?.filter(value => value === header).length, 1);
	}
});

void test("only one row on the Responses sheet can be processed", () => {
	for (const configuration of [{ selectedRows: 2 }, { selectedRow: 1 }, { sheetName: "Track Operations" }]) {
		const sheet = createSheetHarness({
			applications: [acceptedApplication(), acceptedApplication({ "Submission ID": "second" })],
			fetch: successfulFetch,
			...configuration,
		});
		assert.throws(() => sheet.run(), /Select (?:one applicant row|an applicant row)/);
		assert.equal(sheet.requests.length, 0);
	}
});
