/** @OnlyCurrentDoc */

/** @typedef {"XS" | "S" | "M" | "L" | "XL" | "XXL" | "NONE"} TShirtSize */
/** @typedef {"STANDARD" | "VEGETARIAN" | "VEGAN" | "HALAL" | "OTHER"} MealCategory */
/** @typedef {string | number | boolean | Date} SheetCell */
/** @typedef {SheetCell[]} SheetRow */
/** @typedef {{id: string, tShirtSize: TShirtSize, mealCategory: MealCategory, acceptanceExpiry: string, walkIn: boolean}} OperationalRecord */
/** @typedef {{baseUrl: string, apiKey: string, deadline: string, accessClientId: string, accessClientSecret: string}} TrackConfig */
/** @typedef {{id: string, confirmed: boolean, status?: "PENDING" | "CONFIRMED" | "DECLINED", rsvpLink?: string, cancellationLink?: string}} RsvpRecord */
/** @typedef {{records: RsvpRecord[], missingIds: string[]}} RsvpReconciliation */
/** @typedef {{claimUrl: string, expiresAt: string}} ClaimResponse */
/** @typedef {{processed: number}} ProcessedResponse */
/** @typedef {{rowNumber: number, record: OperationalRecord}} PreparedRsvpRow */
/** @typedef {OperationalRecord | {hackers: OperationalRecord[]} | {ids: string[]} | {participants: {id: string, mealCategory: MealCategory}[]}} ApiPayload */

const TRACK_OPERATIONS_SHEET = "Track Operations";
const TRACK_PROPERTIES = {
	baseUrl: "TRACK_BASE_URL",
	apiKey: "SHEETS_INTEGRATION_API_KEY",
	deadline: "RSVP_DEADLINE",
	accessClientId: "CF_ACCESS_CLIENT_ID",
	accessClientSecret: "CF_ACCESS_CLIENT_SECRET",
};

// These columns are appended immediately after the Tally review columns.
// The response row is the operational source of truth; no new tab is needed.
const TRACK_RESPONSE_HEADERS = [
	"Participant ID",
	"T-Shirt Size",
	"Meal Category",
	"RSVP Deadline",
	"RSVP Link",
	"RSVP Status",
	"Cancellation Link",
	"Pass Expires",
	"Last Sync",
	"Walk-In",
	"RSVP Refreshed At",
];

const LEGACY_RESPONSE_HEADERS = [
	"Track Participant ID",
	"Track RSVP Link",
	"Track RSVP Status",
	"Track Cancellation Link",
	"Track Access Expires",
	"Track Last Sync",
];

const TRACK_OPERATION_HEADERS = [
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
	"Walk-In",
];

function onOpen() {
	SpreadsheetApp.getUi()
		.createMenu("Track the Hack")
		.addItem("Pass activation", "openPassSidebar")
		.addItem("Prepare accepted RSVP invitations", "prepareAcceptedRowsForRsvpFromMenu")
		.addToUi();
}

function openPassSidebar() {
	SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile("Sidebar").setTitle("Track the Hack"));
}

/**
 * One-time, operator-invoked migration for the six Track-owned columns in the
 * existing production Responses tab. Never run automatically from the menu.
 * Review and back up the live headers and rows before invoking this function.
 * @returns {number} Number of participant rows retained.
 */
function migrateLegacyResponseColumnsForRsvp() {
	return withOperationsLock_(() => {
		const sheet = SpreadsheetApp.getActiveSheet();
		if (sheet.getName() === TRACK_OPERATIONS_SHEET) throw new Error("Open the Tally responses sheet first.");
		const lastColumn = sheet.getLastColumn();
		const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
		if (!headers) throw new Error("The response sheet has no headers.");
		const review = headers.indexOf("Review reasoning");
		if (review < 0 || headers[review - 1] !== "Admission status") throw new Error("The admission columns are not in the expected position.");
		const start = review + 1;
		if (lastColumn !== start + LEGACY_RESPONSE_HEADERS.length ||
			headers.slice(start).join("\n") !== LEGACY_RESPONSE_HEADERS.join("\n")) {
			throw new Error("The six legacy Track headers are not the exact final columns. No migration was done.");
		}
		const lastRow = sheet.getLastRow();
		const legacy = sheet.getRange(1, start + 1, lastRow, LEGACY_RESPONSE_HEADERS.length).getValues();
		const next = legacy.map((row, index) => index === 0 ? TRACK_RESPONSE_HEADERS : [
			row[0], "", "", "", row[1], row[2], row[3], row[4], row[5], "", "",
		]);
		const requiredColumns = start + TRACK_RESPONSE_HEADERS.length;
		if (sheet.getMaxColumns() < requiredColumns) sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
		sheet.getRange(1, start + 1, lastRow, TRACK_RESPONSE_HEADERS.length).setValues(next);
		return lastRow - 1;
	});
}

/** Append the refresh timestamp to an exact ten-column layout; no-op after migration. */
function migrateResponseRsvpRefreshColumn() {
	return withOperationsLock_(() => {
		const sheet = SpreadsheetApp.getActiveSheet();
		if (sheet.getName() === TRACK_OPERATIONS_SHEET) throw new Error("Open the Tally responses sheet first.");
		const lastColumn = sheet.getLastColumn();
		const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
		if (!headers) throw new Error("The response sheet has no headers.");
		const review = headers.indexOf("Review reasoning");
		if (review < 0 || headers[review - 1] !== "Admission status") {
			throw new Error("The admission columns are not in the expected position. No migration was done.");
		}
		const operationalHeaders = headers.slice(review + 1);
		if (operationalHeaders.join("\n") === TRACK_RESPONSE_HEADERS.join("\n")) return sheet.getLastRow() - 1;
		if (lastColumn !== review + 1 + TRACK_RESPONSE_HEADERS.length - 1 ||
			operationalHeaders.join("\n") !== TRACK_RESPONSE_HEADERS.slice(0, -1).join("\n")) {
			throw new Error("The ten response-row headers are not the exact final columns. No migration was done.");
		}
		if (sheet.getMaxColumns() < lastColumn + 1) sheet.insertColumnsAfter(sheet.getMaxColumns(), 1);
		sheet.getRange(1, lastColumn + 1).setValue("RSVP Refreshed At");
		return sheet.getLastRow() - 1;
	});
}

/**
 * Called by the single sidebar button. The claim endpoint upserts the minimal
 * participant record while creating a one-time QR. No RSVP state is changed.
 * Save the ID before that call so a retry cannot create a second participant.
 * @returns {{displayUrl: string, expiresAt: string}}
 */
function issuePassForSelectedRow() {
	const config = trackConfig_();
	return withOperationsLock_(() => {
		const selected = selectedResponseRows_(1);
		const source = selected.sheet;
		const rowNumber = selected.firstRow;
		const layout = ensureResponseColumns_(source, true);
		const row = source.getRange(rowNumber, 1, 1, source.getLastColumn()).getDisplayValues()[0];
		if (!row) throw new Error("The selected response row is empty.");
		assertAccepted_(layout.headers, row);
		const submissionId = requiredCell_(layout.headers, row, ["Submission ID"]);
		const participantId = responseParticipantId_(source, layout, rowNumber, row, submissionId);
		const record = applicationRowToOperationalRecord_(
			layout.headers,
			row,
			participantId,
			config.deadline,
			booleanCell_(row[layout.start + TRACK_RESPONSE_HEADERS.indexOf("Walk-In")]),
		);
		SpreadsheetApp.flush();
		const claim = claimResponse_(apiPost_(config, "/api/integrations/sheets/claim", record));
		source.getRange(rowNumber, layout.start + TRACK_RESPONSE_HEADERS.indexOf("Pass Expires") + 1).setValue(new Date(claim.expiresAt));
		source.getRange(rowNumber, layout.start + TRACK_RESPONSE_HEADERS.indexOf("Last Sync") + 1).setValue(new Date());
		return { displayUrl: claimDisplayUrl_(claim.claimUrl), expiresAt: claim.expiresAt };
	});
}

/** Review the entire accepted audience without reserving IDs or calling Tracker. */
function reviewAcceptedRowsForRsvp() {
	const config = trackConfig_();
	return withOperationsLock_(() => {
		const source = SpreadsheetApp.getActiveSheet();
		const layout = ensureResponseColumns_(source);
		return { accepted: acceptedRsvpRows_(source, layout, config.deadline, null).length };
	});
}

/** Explicit pre-campaign operation. Selection, filters, and hidden rows do not change eligibility. */
function prepareAcceptedRowsForRsvp() {
	return prepareRsvpRows_(null);
}

/** One-click menu action for the complete status-defined RSVP audience. */
function prepareAcceptedRowsForRsvpFromMenu() {
	migrateResponseRsvpRefreshColumn();
	const result = prepareAcceptedRowsForRsvp();
	SpreadsheetApp.getActive().toast(
		`Prepared ${result.processed} Accepted RSVP invitation${result.processed === 1 ? "" : "s"} in ${result.batches} batch${result.batches === 1 ? "" : "es"}.`,
		"RSVP preparation complete",
		10,
	);
	return result;
}

/** Test one approved submission without touching the rest of the accepted audience. */
function prepareTestSubmissionForRsvp() {
	const submissionId = String(PropertiesService.getScriptProperties().getProperty("TRACK_TEST_SUBMISSION_ID") || "").trim();
	if (!submissionId) throw new Error("Set TRACK_TEST_SUBMISSION_ID to the designated test submission before running this function.");
	return prepareRsvpRows_(submissionId);
}

/** The older selection-based entrypoint must not silently run against a filtered rectangle. */
function prepareSelectedRowsForRsvp() {
	throw new Error("Use reviewAcceptedRowsForRsvp() and prepareAcceptedRowsForRsvp(), or the designated single-submission test action.");
}

/** @param {string | null} targetSubmissionId */
function prepareRsvpRows_(targetSubmissionId) {
	const config = trackConfig_();
	return withOperationsLock_(() => {
		const source = SpreadsheetApp.getActiveSheet();
		const layout = ensureResponseColumns_(source);
		const accepted = acceptedRsvpRows_(source, layout, config.deadline, targetSubmissionId);
		if (!accepted.length) throw new Error(targetSubmissionId ? "No Accepted row matches the designated test submission." : "No Accepted response rows were found.");
		let processed = 0;
		// Each participant requires multiple DB writes; use a smaller batch than
		// the API's 500-record ceiling to stay within its transaction timeout.
		const batchSize = 100;
		for (let offset = 0; offset < accepted.length; offset += batchSize) {
			const batch = accepted.slice(offset, offset + batchSize);
			const records = batch.map(item => item.record);
			const firstRow = batch[0]?.rowNumber || 0;
			const lastRow = batch[batch.length - 1]?.rowNumber || 0;
			try {
				batch.forEach(item => writeResponseRecord_(source, layout, item.rowNumber, item.record));
				// The Sheet-owned IDs must be durable before any server write.
				SpreadsheetApp.flush();
				const result = processedResponse_(apiPost_(config, "/api/integrations/sheets/hackers", { hackers: records }));
				if (result.processed !== records.length) throw new Error("Tracker did not confirm every participant.");
				const reconciliation = rsvpReconciliationResponse_(
					apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", { ids: records.map(record => record.id) }),
				);
				if (reconciliation.missingIds.length) throw new Error("Tracker could not find every provisioned participant.");
				const byId = new Map(reconciliation.records.map(record => [record.id, record]));
				const checked = batch.map(item => {
					const value = byId.get(item.record.id);
					if (!value?.status || !value.rsvpLink) throw new Error(`No complete RSVP result for response row ${item.rowNumber}.`);
					assertRsvpManagementLink_(value.rsvpLink, config.baseUrl);
					return value;
				});
				const now = new Date();
				batch.forEach((item, index) => {
					const result = checked[index];
					const values = source.getRange(item.rowNumber, layout.start + 1, 1, TRACK_RESPONSE_HEADERS.length).getValues()[0];
					if (!result || !values) throw new Error(`Could not save RSVP result for response row ${item.rowNumber}.`);
					values[4] = result.rsvpLink;
					values[5] = result.status;
					values[8] = now;
					values[10] = now;
					source.getRange(item.rowNumber, layout.start + 1, 1, TRACK_RESPONSE_HEADERS.length).setValues([values]);
				});
				processed += batch.length;
			} catch (error) {
				throw new Error(`RSVP batch for response rows ${firstRow}-${lastRow} failed after ${processed} completed row(s). Retry the same action. ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return { accepted: accepted.length, processed, batches: Math.ceil(accepted.length / batchSize) };
	});
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} source @param {{headers: string[], start: number}} layout @param {string} deadline @param {string | null} targetSubmissionId */
function acceptedRsvpRows_(source, layout, deadline, targetSubmissionId) {
	const lastRow = source.getLastRow();
	if (lastRow < 2) return [];
	const rows = source.getRange(2, 1, lastRow - 1, source.getLastColumn()).getDisplayValues();
	const statusColumn = layout.headers.indexOf("Admission status");
	const submissionColumn = layout.headers.indexOf("Submission ID");
	if (submissionColumn < 0) throw new Error("The response sheet has no Submission ID column.");
	const legacy = SpreadsheetApp.getActive().getSheetByName(TRACK_OPERATIONS_SHEET);
	const legacyIds = legacy ? existingParticipantsBySubmission_(legacy) : new Map();
	const submissions = new Set();
	const participants = new Set();
	/** @type {string[]} */
	const failures = [];
	/** @type {PreparedRsvpRow[]} */
	const accepted = [];
	rows.forEach((row, index) => {
		const rowNumber = index + 2;
		if (!isAccepted_(row[statusColumn])) return;
		const submissionId = String(row[submissionColumn] || "").trim();
		if (targetSubmissionId && submissionId !== targetSubmissionId) return;
		try {
			if (!submissionId) throw new Error("missing Submission ID");
			if (!/^[A-Za-z0-9_-]{1,128}$/.test(submissionId)) throw new Error("invalid Submission ID");
			if (submissions.has(submissionId)) throw new Error("duplicate Submission ID");
			submissions.add(submissionId);
			const participantId = responseParticipantId_(source, layout, rowNumber, row, submissionId, false, legacyIds);
			if (!/^[A-Za-z0-9_-]{22,128}$/.test(participantId) || /^\d+$/.test(participantId)) throw new Error("invalid Participant ID");
			if (participants.has(participantId)) throw new Error("duplicate Participant ID");
			participants.add(participantId);
			const record = applicationRowToOperationalRecord_(layout.headers, row, participantId, deadline,
				booleanCell_(row[layout.start + TRACK_RESPONSE_HEADERS.indexOf("Walk-In")]));
			accepted.push({ rowNumber, record });
		} catch (error) {
			failures.push(`row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`);
		}
	});
	if (failures.length) throw new Error(`Resolve these Accepted response rows before provisioning: ${failures.slice(0, 20).join("; ")}${failures.length > 20 ? `; and ${failures.length - 20} more` : ""}`);
	return accepted;
}

/** Review existing accepted participants whose mapped meal category differs from the response row. */
function reviewExistingDietaryCategories() {
	return withOperationsLock_(() => {
		const source = SpreadsheetApp.getActiveSheet();
		const layout = ensureResponseColumns_(source);
		return { changed: existingDietaryRows_(source, layout).length };
	});
}

/** Update only Meal Category for already provisioned participants; no RSVP or claim writes. */
function reconcileExistingDietaryCategories() {
	const config = trackConfig_();
	return withOperationsLock_(() => {
		const source = SpreadsheetApp.getActiveSheet();
		const layout = ensureResponseColumns_(source);
		const changed = existingDietaryRows_(source, layout);
		let processed = 0;
		for (let offset = 0; offset < changed.length; offset += 500) {
			const batch = changed.slice(offset, offset + 500);
			const ids = batch.map(item => item.id);
			const result = rsvpReconciliationResponse_(apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", { ids }));
			if (result.missingIds.length) {
				const missing = new Set(result.missingIds);
				throw new Error(`No existing Tracker participant for ${batch.filter(item => missing.has(item.id)).map(item => `row ${item.rowNumber}`).join(", ")}. No meal categories were changed in this batch.`);
			}
			const response = processedResponse_(apiPost_(config, "/api/integrations/sheets/dietary-reconciliation", {
				participants: batch.map(item => ({ id: item.id, mealCategory: item.mealCategory })),
			}));
			if (response.processed !== batch.length) throw new Error(`Tracker did not confirm dietary reconciliation for response rows ${batch[0]?.rowNumber}-${batch[batch.length - 1]?.rowNumber}.`);
			const now = new Date();
			batch.forEach(item => {
				source.getRange(item.rowNumber, layout.start + TRACK_RESPONSE_HEADERS.indexOf("Meal Category") + 1).setValue(item.mealCategory);
				source.getRange(item.rowNumber, layout.start + TRACK_RESPONSE_HEADERS.indexOf("Last Sync") + 1).setValue(now);
			});
			processed += batch.length;
		}
		return { changed: changed.length, processed };
	});
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} source @param {{headers: string[], start: number}} layout */
function existingDietaryRows_(source, layout) {
	const lastRow = source.getLastRow();
	if (lastRow < 2) return [];
	const rows = source.getRange(2, 1, lastRow - 1, source.getLastColumn()).getDisplayValues();
	const statusColumn = layout.headers.indexOf("Admission status");
	const idColumn = layout.start + TRACK_RESPONSE_HEADERS.indexOf("Participant ID");
	const mealColumn = layout.start + TRACK_RESPONSE_HEADERS.indexOf("Meal Category");
	/** @type {{rowNumber: number, id: string, mealCategory: MealCategory}[]} */
	const changed = [];
	/** @type {string[]} */
	const failures = [];
	const ids = new Set();
	rows.forEach((row, index) => {
		if (!isAccepted_(row[statusColumn])) return;
		const id = String(row[idColumn] || "").trim();
		if (!id) return;
		const rowNumber = index + 2;
		try {
			if (!/^[A-Za-z0-9_-]{22,128}$/.test(id) || /^\d+$/.test(id)) throw new Error("invalid Participant ID");
			if (ids.has(id)) throw new Error("duplicate Participant ID");
			ids.add(id);
			const mealCategory = mealCategory_(layout.headers, row);
			if (mealCategory !== String(row[mealColumn] || "").trim()) changed.push({ rowNumber, id, mealCategory });
		} catch (error) {
			failures.push(`row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`);
		}
	});
	if (failures.length) throw new Error(`Resolve these dietary rows before reconciliation: ${failures.slice(0, 20).join("; ")}${failures.length > 20 ? `; and ${failures.length - 20} more` : ""}`);
	return changed;
}

/** Refresh the RSVP columns in the Tally response rows. Call from a reviewed operations process. */
function refreshResponseRsvpStatus() {
	const config = trackConfig_();
	return withOperationsLock_(() => {
		const source = SpreadsheetApp.getActiveSheet();
		if (source.getName() === TRACK_OPERATIONS_SHEET) throw new Error("Open the Tally responses sheet first.");
		const layout = ensureResponseColumns_(source);
		const lastRow = source.getLastRow();
		if (lastRow < 2) return 0;
		const values = source.getRange(2, layout.start + 1, lastRow - 1, TRACK_RESPONSE_HEADERS.length).getValues();
		const ids = values.map(row => String(row[0] || "").trim()).filter(Boolean);
		if (!ids.length) return 0;
		/** @type {Record<string, RsvpRecord | null>} */
		const byId = {};
		for (let offset = 0; offset < ids.length; offset += 500) {
			const result = rsvpReconciliationResponse_(
				apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", { ids: ids.slice(offset, offset + 500) }),
			);
			result.records.forEach(record => (byId[record.id] = record));
			result.missingIds.forEach(id => (byId[id] = null));
		}
		const now = new Date();
		values.forEach(row => {
			const id = String(row[0] || "").trim();
			if (!id) return;
			if (!Object.prototype.hasOwnProperty.call(byId, id)) throw new Error(`Tracker returned no RSVP status for ${id}.`);
			const record = byId[id];
			row[5] = record === null ? "MISSING" : record?.status || (record?.confirmed ? "CONFIRMED" : "PENDING");
			if (record?.rsvpLink) { assertRsvpManagementLink_(record.rsvpLink, config.baseUrl); row[4] = record.rsvpLink; }
			row[6] = record?.cancellationLink || "";
			row[8] = now;
			row[10] = now;
		});
		source.getRange(2, layout.start + 1, values.length, TRACK_RESPONSE_HEADERS.length).setValues(values);
		return ids.length;
	});
}

/** @param {number} maxRows */
function selectedResponseRows_(maxRows) {
	const sheet = SpreadsheetApp.getActiveSheet();
	if (sheet.getName() === TRACK_OPERATIONS_SHEET) throw new Error("Select a row on the Tally responses sheet.");
	const selection = sheet.getActiveRange();
	if (!selection) throw new Error("Select a participant row first.");
	const firstRow = selection.getRow();
	const rowCount = selection.getNumRows();
	if (firstRow < 2 || rowCount < 1 || rowCount > maxRows) throw new Error(`Select ${maxRows === 1 ? "one response row" : `1 to ${maxRows} response rows`}.`);
	return { sheet, firstRow, rowCount };
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {boolean} [initializeBlank] */
function ensureResponseColumns_(sheet, initializeBlank = false) {
	const lastColumn = sheet.getLastColumn();
	const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
	if (!headers) throw new Error("The Tally response sheet has no headers.");
	const review = headers.indexOf("Review reasoning");
	if (review < 0 || headers[review - 1] !== "Admission status") {
		throw new Error("Expected Admission status and Review reasoning at the end of the Tally response columns.");
	}
	const start = review + 1;
	const current = sheet.getRange(1, start + 1, 1, TRACK_RESPONSE_HEADERS.length).getDisplayValues()[0];
	if (!current) throw new Error("The response-row headers could not be read.");
	if (current.every(value => !value) && initializeBlank) {
		sheet.getRange(1, start + 1, 1, TRACK_RESPONSE_HEADERS.length).setValues([TRACK_RESPONSE_HEADERS]);
	} else if (current.join("\n") !== TRACK_RESPONSE_HEADERS.join("\n")) {
		throw new Error("Columns after Review reasoning do not match Tracker's response-row fields. No values were changed.");
	}
	return { headers, start };
}

/** @param {string[]} headers @param {string[]} row */
function assertAccepted_(headers, row) {
	const status = requiredCell_(headers, row, ["Admission status"]);
	if (!isAccepted_(status)) throw new Error("This row must have Admission status Accepted before issuing a pass.");
}

/** @param {SheetCell | undefined} value */
function isAccepted_(value) {
	return /^(accepted|accepté|acceptée)$/i.test(String(value || "").trim());
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {{start: number}} layout @param {number} rowNumber @param {string[]} row @param {string} submissionId @param {boolean} [persist] @param {Map<string, string>} [legacyIds] */
function responseParticipantId_(sheet, layout, rowNumber, row, submissionId, persist = true, legacyIds) {
	const idColumn = layout.start + TRACK_RESPONSE_HEADERS.indexOf("Participant ID") + 1;
	const current = String(row[idColumn - 1] || "").trim();
	const legacy = legacyIds ? null : SpreadsheetApp.getActive().getSheetByName(TRACK_OPERATIONS_SHEET);
	const oldId = (legacyIds || (legacy ? existingParticipantsBySubmission_(legacy) : new Map())).get(submissionId);
	if (current && oldId && current !== oldId) throw new Error(`Conflicting participant IDs for Submission ID: ${submissionId}`);
	const id = current || oldId || createParticipantId_();
	if (!current && persist) sheet.getRange(rowNumber, idColumn).setValue(id);
	return id;
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {{start: number}} layout @param {number} rowNumber @param {OperationalRecord} record */
function writeResponseRecord_(sheet, layout, rowNumber, record) {
	const existing = sheet.getRange(rowNumber, layout.start + 1, 1, TRACK_RESPONSE_HEADERS.length).getValues()[0];
	if (!existing) throw new Error("The response-row fields could not be read.");
	existing[0] = record.id;
	existing[1] = record.tShirtSize;
	existing[2] = record.mealCategory;
	// Keep this as ISO text so a CSV export preserves the exact instant.
	existing[3] = record.acceptanceExpiry;
	// Preserve an existing signed RSVP link across failed or retried upserts.
	existing[9] = record.walkIn;
	sheet.getRange(rowNumber, layout.start + 1, 1, TRACK_RESPONSE_HEADERS.length).setValues([existing]);
}

function setupTrackOperations() {
	const sheet = withOperationsLock_(() => ensureOperationsSheet_());
	SpreadsheetApp.getActive().setActiveSheet(sheet);
}

/**
 * @template T
 * @param {() => T} operation
 * @returns {T}
 */
function withOperationsLock_(operation) {
	const lock = LockService.getDocumentLock();
	if (!lock) throw new Error("Run Tracker operations from the bound Google Sheet.");
	if (!lock.tryLock(30000)) throw new Error("Another Tracker operation is running. Try again shortly.");
	try {
		return operation();
	} finally {
		try {
			SpreadsheetApp.flush();
		} finally {
			lock.releaseLock();
		}
	}
}

function acceptSelectedApplications() {
	throw new Error("This legacy selection-based acceptance action is disabled. Record Accepted in the Responses tab, then use prepareAcceptedRowsForRsvp().");
}

function acceptSelectedWalkInApplications() {
	throw new Error("This legacy operations-tab action is disabled. Have a lead approve the walk-in, mark its response Accepted and Walk-In, then use the Responses-tab flow.");
}

function refreshRsvpStatus() {
	const count = withOperationsLock_(refreshRsvpStatus_);
	SpreadsheetApp.getUi().alert(`${count} participant(s) reconciled.`);
}

function refreshRsvpStatus_() {
	const config = trackConfig_();
	const sheet = ensureOperationsSheet_();
	const lastRow = sheet.getLastRow();
	if (lastRow < 2) throw new Error("There are no accepted participants to reconcile.");

	const rows = sheet.getRange(2, 1, lastRow - 1, TRACK_OPERATION_HEADERS.length).getValues();
	const idColumn = TRACK_OPERATION_HEADERS.indexOf("Participant ID");
	const ids = rows.map(row => String(row[idColumn] || "")).filter(Boolean);
	if (!ids.length) throw new Error("There are no participant IDs to reconcile.");
	/** @type {Record<string, RsvpRecord | null>} */
	const byId = {};

	for (let offset = 0; offset < ids.length; offset += 500) {
		const response = rsvpReconciliationResponse_(
			apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", {
				ids: ids.slice(offset, offset + 500),
			}),
		);
		response.records.forEach(record => (byId[record.id] = record));
		response.missingIds.forEach(id => (byId[id] = null));
	}

	const now = new Date();
	applyRsvpReconciliation_(rows, byId, now);
	sheet.getRange(2, 1, rows.length, TRACK_OPERATION_HEADERS.length).setValues(rows);
	return ids.length;
}

/**
 * @param {SheetRow[]} rows
 * @param {Record<string, RsvpRecord | null>} byId
 * @param {Date} now
 * @returns {SheetRow[]}
 */
function applyRsvpReconciliation_(rows, byId, now) {
	const idColumn = TRACK_OPERATION_HEADERS.indexOf("Participant ID");
	const statusColumn = TRACK_OPERATION_HEADERS.indexOf("RSVP Status");
	const cancellationColumn = TRACK_OPERATION_HEADERS.indexOf("Cancellation Link");
	const syncColumn = TRACK_OPERATION_HEADERS.indexOf("Last Sync");
	rows.forEach(row => {
		const id = String(row[idColumn] || "").trim();
		if (!id) return;
		if (!Object.prototype.hasOwnProperty.call(byId, id)) {
			throw new Error(`Tracker API did not return a reconciliation result for ${id}.`);
		}
		const record = byId[id];
		if (record === undefined) throw new Error(`Tracker API returned an invalid reconciliation result for ${id}.`);
		row[statusColumn] = record === null ? "MISSING" : record.confirmed ? "CONFIRMED" : "PENDING";
		row[cancellationColumn] = record && record.cancellationLink ? record.cancellationLink : "";
		row[syncColumn] = now;
	});
	return rows;
}

function issueAccessForSelectedParticipant() {
	const config = trackConfig_();
	const sheet = SpreadsheetApp.getActiveSheet();
	const selection = sheet.getActiveRange();
	if (
		sheet.getName() !== TRACK_OPERATIONS_SHEET ||
		!selection ||
		selection.getRow() < 2 ||
		selection.getNumRows() !== 1
	) {
		throw new Error("Select one participant row on the Track Operations sheet.");
	}

	const rowNumber = selection.getRow();
	const response = withOperationsLock_(() => {
		const row = sheet.getRange(rowNumber, 1, 1, TRACK_OPERATION_HEADERS.length).getValues()[0];
		if (!row) throw new Error("The selected participant row is empty.");
		const claim = claimResponse_(
			apiPost_(config, "/api/integrations/sheets/claim", operationalRecordFromRow_(row)),
		);
		sheet
			.getRange(rowNumber, TRACK_OPERATION_HEADERS.indexOf("Access Expires") + 1)
			.setValue(new Date(claim.expiresAt));
		return claim;
	});

	const displayUrl = claimDisplayUrl_(response.claimUrl);
	const html = HtmlService.createHtmlOutput(
		`<p>This access code expires in five minutes.</p><p><a href="${escapeHtml_(displayUrl)}" target="_blank">Open access QR</a></p>`,
	)
		.setWidth(360)
		.setHeight(140);
	SpreadsheetApp.getUi().showModalDialog(html, "Participant access");
}

/** @param {string} claimUrl */
function claimDisplayUrl_(claimUrl) {
	const value = String(claimUrl || "");
	const displayUrl = value.replace("/claim#", "/claim/qr#");
	if (displayUrl === value || !/^https:\/\//.test(displayUrl)) {
		throw new Error("Tracker API returned an invalid claim URL.");
	}
	return displayUrl;
}

/**
 * @param {string[]} headers
 * @param {string[]} row
 * @param {string} participantId
 * @param {string | Date} acceptanceExpiry
 * @param {boolean} [walkIn]
 * @returns {OperationalRecord}
 */
function applicationRowToOperationalRecord_(headers, row, participantId, acceptanceExpiry, walkIn = false) {
	return {
		id: participantId,
		tShirtSize: tShirtSize_(headers, row),
		mealCategory: mealCategory_(headers, row),
		acceptanceExpiry: isoDate_(acceptanceExpiry),
		walkIn: Boolean(walkIn),
	};
}

/**
 * @param {string[]} headers
 * @param {string[]} row
 * @returns {TShirtSize}
 */
function tShirtSize_(headers, row) {
	const raw = requiredCell_(headers, row, [
		"What unisex T-shirt size would you prefer?",
		"Quelle taille de t-shirt unisexe préférez-vous?",
	]).toUpperCase();
	if (raw === "I DO NOT WANT A T-SHIRT" || raw === "JE NE SOUHAITE PAS RECEVOIR DE T-SHIRT") return "NONE";
	const size = raw.match(/(?:^|\b)(XXL|2XL|XL|XS|L|M|S)(?:\b|$)/)?.[1];
	if (size === "2XL") return "XXL";
	if (size === "XXL" || size === "XL" || size === "L" || size === "M" || size === "S" || size === "XS") {
		return size;
	}
	throw new Error(`Unsupported T-shirt size: ${raw}`);
}

/**
 * @param {string[]} headers
 * @param {string[]} row
 * @returns {MealCategory}
 */
function mealCategory_(headers, row) {
	/** @param {string} value */
	const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
	const simple = new Set();
	let additional = false;
	let reportedRestriction = false;
	/** @param {string} value */
	const classify = value => {
		const answer = normalize(value);
		if (!answer || /^(false|no|non|none|n\/a|aucun.*|pas de restriction.*)$/.test(answer)) return;
		if (/^(vegan|regime vegetalien|vegetalien|vegetalienne)$/.test(answer)) simple.add("VEGAN");
		else if (/^(vegetarian|regime vegetarien|vegetarien|vegetarienne)$/.test(answer)) simple.add("VEGETARIAN");
		else if (/^(halal|alimentation halal)$/.test(answer)) simple.add("HALAL");
		else additional = true;
	};
	headers.forEach((header, index) => {
		const value = String(row[index] || "").trim();
		if (!value) return;
		const name = normalize(header);
		if (/^(do you have any dietary restrictions or food allergies\?|avez-vous des restrictions alimentaires ou des allergies alimentaires\?)$/.test(name)) {
			reportedRestriction = /^(yes|oui|true)$/i.test(value);
			return;
		}
		if (/^(please specify your allergy or restriction\.|veuillez preciser votre allergie ou restriction\.)$/.test(name)) {
			if (!/^(none|no|non|n\/a|aucun.*)$/i.test(value)) additional = true;
			return;
		}
		const english = header === "Select all that apply." || header.startsWith("Select all that apply. (");
		const french = header.startsWith("Si vous avez des restrictions alimentaires ou des allergies, sélectionnez-les ci-dessous:");
		if (!english && !french) return;
		if (/^(false|no|non|none|n\/a|aucun.*)$/i.test(value)) return;
		const option = header.match(/\(([^()]*)\)$/)?.[1];
		if (option) classify(/^(true|yes|oui)$/i.test(value) ? option : value);
		else value.split(/[,;\n]+/).forEach(classify);
	});
	if (additional || simple.size > 1 || (reportedRestriction && simple.size === 0)) return "OTHER";
	return simple.values().next().value || "STANDARD";
}

/**
 * @param {string[]} headers
 * @param {string[]} row
 * @param {string[]} names
 */
function requiredCell_(headers, row, names) {
	for (const name of names) {
		const index = headers.indexOf(name);
		const value = index === -1 ? "" : String(row[index] || "").trim();
		if (value) return value;
	}
	throw new Error(`Missing required Sheet value: ${names.join(" / ")}`);
}

/**
 * @param {SheetRow} row
 * @returns {OperationalRecord}
 */
function operationalRecordFromRow_(row) {
	/** @param {string} header */
	const value = header => row[TRACK_OPERATION_HEADERS.indexOf(header)];
	const id = String(value("Participant ID") || "").trim();
	if (!id) throw new Error("The selected operations row has no participant ID.");
	return {
		id,
		tShirtSize: operationalTShirtSize_(value("T-Shirt Size")),
		mealCategory: operationalMealCategory_(value("Meal Category")),
		acceptanceExpiry: isoDate_(value("Acceptance Expires")),
		walkIn: booleanCell_(value("Walk-In")),
	};
}

/**
 * @param {SheetCell | undefined} value
 * @returns {TShirtSize}
 */
function operationalTShirtSize_(value) {
	const size = String(value || "")
		.trim()
		.toUpperCase();
	if (size === "NONE") return "NONE";
	if (size === "XXL" || size === "XL" || size === "L" || size === "M" || size === "S" || size === "XS") {
		return size;
	}
	throw new Error(`The selected operations row has an invalid T-shirt size: ${size || "missing"}.`);
}

/**
 * @param {SheetCell | undefined} value
 * @returns {MealCategory}
 */
function operationalMealCategory_(value) {
	const category = String(value || "")
		.trim()
		.toUpperCase();
	if (
		category === "STANDARD" ||
		category === "VEGETARIAN" ||
		category === "VEGAN" ||
		category === "HALAL" ||
		category === "OTHER"
	) {
		return category;
	}
	throw new Error(`The selected operations row has an invalid meal category: ${category || "missing"}.`);
}

function trackConfig_() {
	const properties = PropertiesService.getScriptProperties();
	const baseUrl = String(properties.getProperty(TRACK_PROPERTIES.baseUrl) || "").replace(/\/$/, "");
	const apiKey = String(properties.getProperty(TRACK_PROPERTIES.apiKey) || "");
	const deadline = String(properties.getProperty(TRACK_PROPERTIES.deadline) || "");
	const accessClientId = String(properties.getProperty(TRACK_PROPERTIES.accessClientId) || "");
	const accessClientSecret = String(properties.getProperty(TRACK_PROPERTIES.accessClientSecret) || "");
	if (!/^https:\/\//.test(baseUrl) || !apiKey || !deadline) {
		throw new Error(
			"Set an HTTPS TRACK_BASE_URL, SHEETS_INTEGRATION_API_KEY, and RSVP_DEADLINE in Apps Script project properties.",
		);
	}
	if (Boolean(accessClientId) !== Boolean(accessClientSecret)) {
		throw new Error("Set both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET, or neither.");
	}
	return { baseUrl, apiKey, deadline: isoDate_(deadline), accessClientId, accessClientSecret };
}

/**
 * @param {TrackConfig} config
 * @param {string} path
 * @param {ApiPayload} payload
 * @returns {string}
 */
function apiPost_(config, path, payload) {
	const response = UrlFetchApp.fetch(`${config.baseUrl}${path}`, {
		method: "post",
		contentType: "application/json",
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			...(config.accessClientId ? {
				"CF-Access-Client-Id": config.accessClientId,
				"CF-Access-Client-Secret": config.accessClientSecret,
			} : {}),
		},
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	});
	const status = response.getResponseCode();
	const body = response.getContentText();
	if (status < 200 || status >= 300) throw new Error(`Tracker API ${status}: ${body.slice(0, 500)}`);
	return body;
}

/**
 * @param {string} body
 * @returns {ProcessedResponse}
 */
function processedResponse_(body) {
	const value = JSON.parse(body);
	if (
		value === null ||
		Array.isArray(value) ||
		typeof value !== "object" ||
		typeof value.processed !== "number" ||
		!Number.isInteger(value.processed) ||
		value.processed < 0
	) {
		throw new Error("Tracker API returned an invalid processed response.");
	}
	return { processed: value.processed };
}

/**
 * @param {string} body
 * @returns {RsvpReconciliation}
 */
function rsvpReconciliationResponse_(body) {
	const value = JSON.parse(body);
	if (value === null || Array.isArray(value) || typeof value !== "object") {
		throw new Error("Tracker API returned an invalid RSVP reconciliation response.");
	}
	const records = value.records;
	const missingIds = value.missingIds;
	if (!Array.isArray(records) || !Array.isArray(missingIds) || !missingIds.every(id => typeof id === "string")) {
		throw new Error("Tracker API returned an invalid RSVP reconciliation response.");
	}

	const parsedRecords = records.map(record => {
		if (record === null || Array.isArray(record) || typeof record !== "object") {
			throw new Error("Tracker API returned an invalid RSVP reconciliation record.");
		}
		const { id, confirmed, status, rsvpLink, cancellationLink } = record;
		if (
			typeof id !== "string" ||
			typeof confirmed !== "boolean" ||
			(status !== undefined && status !== "PENDING" && status !== "CONFIRMED" && status !== "DECLINED") ||
			(rsvpLink !== undefined && typeof rsvpLink !== "string") ||
			(cancellationLink !== undefined && typeof cancellationLink !== "string")
		) {
			throw new Error("Tracker API returned an invalid RSVP reconciliation record.");
		}
		return {
			id, confirmed,
			...(status === undefined ? {} : { status }),
			...(rsvpLink === undefined ? {} : { rsvpLink }),
			...(cancellationLink === undefined ? {} : { cancellationLink }),
		};
	});
	return { records: parsedRecords, missingIds };
}

/** @param {string} link @param {string} baseUrl */
function assertRsvpManagementLink_(link, baseUrl) {
	if (!link.startsWith(`${baseUrl}/rsvp/manage#`) || !/#[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(link)) {
		throw new Error("Tracker returned an invalid RSVP management link.");
	}
}

/**
 * @param {string} body
 * @returns {ClaimResponse}
 */
function claimResponse_(body) {
	const value = JSON.parse(body);
	if (
		value === null ||
		Array.isArray(value) ||
		typeof value !== "object" ||
		typeof value.claimUrl !== "string" ||
		typeof value.expiresAt !== "string"
	) {
		throw new Error("Tracker API returned an invalid claim response.");
	}
	return { claimUrl: value.claimUrl, expiresAt: value.expiresAt };
}

function ensureOperationsSheet_() {
	const spreadsheet = SpreadsheetApp.getActive();
	const sheet = spreadsheet.getSheetByName(TRACK_OPERATIONS_SHEET) || spreadsheet.insertSheet(TRACK_OPERATIONS_SHEET);
	const current = sheet.getRange(1, 1, 1, TRACK_OPERATION_HEADERS.length).getDisplayValues()[0];
	if (!current) throw new Error(`The ${TRACK_OPERATIONS_SHEET} header row could not be read.`);
	if (current.every(value => !value)) {
		sheet.getRange(1, 1, 1, TRACK_OPERATION_HEADERS.length).setValues([TRACK_OPERATION_HEADERS]);
		sheet.setFrozenRows(1);
	} else if (current.join("\n") !== TRACK_OPERATION_HEADERS.join("\n")) {
		const previousHeaders = TRACK_OPERATION_HEADERS.slice(0, -1);
		const hasPreviousHeaders =
			current.slice(0, -1).join("\n") === previousHeaders.join("\n") && !current[current.length - 1];
		if (!hasPreviousHeaders) {
			throw new Error(`The ${TRACK_OPERATIONS_SHEET} header row does not match this integration.`);
		}
		sheet.getRange(1, TRACK_OPERATION_HEADERS.length).setValue("Walk-In");
	}
	return sheet;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Map<string, string>}
 */
function existingParticipantsBySubmission_(sheet) {
	if (sheet.getLastRow() < 2) return new Map();
	const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, TRACK_OPERATION_HEADERS.length).getDisplayValues();
	const sourceColumn = TRACK_OPERATION_HEADERS.indexOf("Source Submission ID");
	const idColumn = TRACK_OPERATION_HEADERS.indexOf("Participant ID");
	/** @type {Map<string, string>} */
	const result = new Map();
	for (const row of rows) {
		const submissionId = row[sourceColumn];
		const participantId = row[idColumn];
		if (!submissionId || !participantId) continue;
		const previousId = result.get(submissionId);
		if (previousId && previousId !== participantId) {
			throw new Error(`Conflicting participant IDs for Submission ID: ${submissionId}`);
		}
		result.set(submissionId, participantId);
	}
	return result;
}

function createParticipantId_() {
	return `${Utilities.getUuid()}${Utilities.getUuid()}`.replace(/-/g, "");
}

/** @param {SheetCell | undefined} value */
function isoDate_(value) {
	if (value === undefined || typeof value === "boolean") throw new Error(`Invalid RSVP deadline: ${value}`);
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid RSVP deadline: ${value}`);
	return date.toISOString();
}

/** @param {SheetCell | undefined} value */
function booleanCell_(value) {
	return value === true || /^(?:true|yes|oui|walk-in)$/i.test(String(value || "").trim());
}

/** @param {string} value */
function escapeHtml_(value) {
	return String(value).replace(/[&<>"]/g, character => {
		if (character === "&") return "&amp;";
		if (character === "<") return "&lt;";
		if (character === ">") return "&gt;";
		return "&quot;";
	});
}
