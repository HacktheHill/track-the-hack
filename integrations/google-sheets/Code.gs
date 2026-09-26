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
/** @typedef {{refreshed: number, pending: number, confirmed: number, declined: number}} RsvpRefreshSummary */
/** @typedef {{rowNumber: number, record: OperationalRecord}} PreparedRsvpRow */
/** @typedef {OperationalRecord | {hackers: OperationalRecord[]} | {ids: string[]} | {participants: {id: string, mealCategory: MealCategory}[]}} ApiPayload */

const TRACK_RESPONSES_SHEET = "Responses";
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

// Keep operational columns readable without inheriting the unusually wide
// legacy link-column width from the final Tally response column.
const TRACK_RESPONSE_COLUMN_WIDTHS = [260, 110, 130, 175, 300, 120, 300, 175, 175, 90, 175];

function onOpen() {
	SpreadsheetApp.getUi()
		.createMenu("Track the Hack")
		.addItem("Pass activation", "openPassSidebar")
		.addItem("Prepare accepted RSVP invitations", "prepareAcceptedRowsForRsvpFromMenu")
		.addItem("Refresh RSVP responses", "refreshResponseRsvpStatusFromMenu")
		.addToUi();
}

function openPassSidebar() {
	SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile("Sidebar").setTitle("Track the Hack"));
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {number} firstColumn */
function applyResponseColumnWidths_(sheet, firstColumn) {
	TRACK_RESPONSE_COLUMN_WIDTHS.forEach((width, index) => sheet.setColumnWidth(firstColumn + index, width));
}

/**
 * Called by the single sidebar button. The claim endpoint upserts the minimal
 * participant record while creating a one-time QR. No RSVP state is changed.
 * Save the ID before that call so a retry cannot create a second participant.
 * @returns {{displayUrl: string, expiresAt: string}}
 */
function issuePassForSelectedRow() {
	const config = trackConfig_();
	const prepared = withDocumentLock_(() => {
		const selected = selectedResponseRows_(1);
		const source = selected.sheet;
		const rowNumber = selected.firstRow;
		const layout = ensureResponseColumns_(source, true);
		const row = source.getRange(rowNumber, 1, 1, source.getLastColumn()).getDisplayValues()[0];
		if (!row) throw new Error("The selected response row is empty.");
		assertAccepted_(layout.headers, row);
		requiredCell_(layout.headers, row, ["Submission ID"]);
		const participantId = responseParticipantId_(source, layout, rowNumber, row);
		const record = applicationRowToOperationalRecord_(
			layout.headers,
			row,
			participantId,
			config.deadline,
			booleanCell_(row[layout.start + TRACK_RESPONSE_HEADERS.indexOf("Walk-In")]),
		);
		return { source, rowNumber, layout, record };
	});
	// Never hold the Sheet-wide lock across a network request. Bulk RSVP work can
	// take minutes, while pass activation must remain available to other users.
	const claim = claimResponse_(apiPost_(config, "/api/integrations/sheets/claim", prepared.record));
	withDocumentLock_(() => {
		assertResponseParticipantId_(prepared.source, prepared.layout, prepared.rowNumber, prepared.record.id);
		prepared.source.getRange(prepared.rowNumber, prepared.layout.start + TRACK_RESPONSE_HEADERS.indexOf("Pass Expires") + 1).setValue(new Date(claim.expiresAt));
		prepared.source.getRange(prepared.rowNumber, prepared.layout.start + TRACK_RESPONSE_HEADERS.indexOf("Last Sync") + 1).setValue(new Date());
	});
	return { displayUrl: claimDisplayUrl_(claim.claimUrl), expiresAt: claim.expiresAt };
}

/** Review the entire accepted audience without reserving IDs or calling Tracker. */
function reviewAcceptedRowsForRsvp() {
	const config = trackConfig_();
	return withDocumentLock_(() => {
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

/** @param {string | null} targetSubmissionId */
function prepareRsvpRows_(targetSubmissionId) {
	const config = trackConfig_();
	const prepared = withDocumentLock_(() => {
		const source = SpreadsheetApp.getActiveSheet();
		const layout = ensureResponseColumns_(source);
		const accepted = acceptedRsvpRows_(source, layout, config.deadline, targetSubmissionId);
		if (!accepted.length) throw new Error(targetSubmissionId ? "No Accepted row matches the designated test submission." : "No Accepted response rows were found.");
		// Make every Sheet-owned ID durable before releasing the lock. Pass
		// activation and campaign preparation then share the same stable identity.
		accepted.forEach(item => writeResponseRecord_(source, layout, item.rowNumber, item.record));
		return { source, layout, accepted };
	});
	let processed = 0;
	// Each participant requires multiple DB writes; use a smaller batch than
	// the API's 500-record ceiling to stay within its transaction timeout.
	const batchSize = 100;
	for (let offset = 0; offset < prepared.accepted.length; offset += batchSize) {
		const batch = prepared.accepted.slice(offset, offset + batchSize);
		const records = batch.map(item => item.record);
		const firstRow = batch[0]?.rowNumber || 0;
		const lastRow = batch[batch.length - 1]?.rowNumber || 0;
		try {
			// Network work intentionally runs outside the Sheet-wide lock.
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
			withDocumentLock_(() => {
				batch.forEach((item, index) => {
					const result = checked[index];
					assertResponseParticipantId_(prepared.source, prepared.layout, item.rowNumber, item.record.id);
					const values = prepared.source.getRange(item.rowNumber, prepared.layout.start + 1, 1, TRACK_RESPONSE_HEADERS.length).getValues()[0];
					if (!result || !values) throw new Error(`Could not save RSVP result for response row ${item.rowNumber}.`);
					values[4] = result.rsvpLink;
					values[5] = result.status;
					values[8] = now;
					values[10] = now;
					prepared.source.getRange(item.rowNumber, prepared.layout.start + 1, 1, TRACK_RESPONSE_HEADERS.length).setValues([values]);
				});
			});
			processed += batch.length;
		} catch (error) {
			throw new Error(`RSVP batch for response rows ${firstRow}-${lastRow} failed after ${processed} completed row(s). Retry the same action. ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	return { accepted: prepared.accepted.length, processed, batches: Math.ceil(prepared.accepted.length / batchSize) };
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} source @param {{headers: string[], start: number}} layout @param {string} deadline @param {string | null} targetSubmissionId */
function acceptedRsvpRows_(source, layout, deadline, targetSubmissionId) {
	const lastRow = source.getLastRow();
	if (lastRow < 2) return [];
	const rows = source.getRange(2, 1, lastRow - 1, source.getLastColumn()).getDisplayValues();
	const statusColumn = layout.headers.indexOf("Admission status");
	const submissionColumn = layout.headers.indexOf("Submission ID");
	if (submissionColumn < 0) throw new Error("The response sheet has no Submission ID column.");
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
			const participantId = responseParticipantId_(source, layout, rowNumber, row, false);
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
	return withDocumentLock_(() => {
		const source = SpreadsheetApp.getActiveSheet();
		const layout = ensureResponseColumns_(source);
		return { changed: existingDietaryRows_(source, layout).length };
	});
}

/** Update only Meal Category for already provisioned participants; no RSVP or claim writes. */
function reconcileExistingDietaryCategories() {
	const config = trackConfig_();
	return withDocumentLock_(() => {
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

/** Refresh every provisioned response row without changing RSVP state in Tracker. */
function refreshResponseRsvpStatus() {
	const config = trackConfig_();
	return withDocumentLock_(() => {
		const source = SpreadsheetApp.getActiveSheet();
		const layout = ensureResponseColumns_(source);
		const lastRow = source.getLastRow();
		/** @type {RsvpRefreshSummary} */
		const summary = { refreshed: 0, pending: 0, confirmed: 0, declined: 0 };
		if (lastRow < 2) return summary;
		const values = source.getRange(2, layout.start + 1, lastRow - 1, TRACK_RESPONSE_HEADERS.length).getValues();
		const ids = values.map(row => String(row[0] || "").trim()).filter(Boolean);
		if (!ids.length) return summary;
		if (new Set(ids).size !== ids.length) throw new Error("Resolve duplicate Participant IDs before refreshing RSVP responses.");
		/** @type {Record<string, RsvpRecord>} */
		const byId = {};
		for (let offset = 0; offset < ids.length; offset += 500) {
			const result = rsvpReconciliationResponse_(
				apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", { ids: ids.slice(offset, offset + 500) }),
			);
			if (result.missingIds.length) {
				throw new Error(`Tracker could not find ${result.missingIds.length} provisioned participant${result.missingIds.length === 1 ? "" : "s"}. No RSVP fields were changed.`);
			}
			result.records.forEach(record => (byId[record.id] = record));
		}
		const reconciled = values.map(row => {
			const id = String(row[0] || "").trim();
			if (!id) return null;
			const record = byId[id];
			if (!record) throw new Error("Tracker returned an incomplete RSVP response. No RSVP fields were changed.");
			const status = record.status || (record.confirmed ? "CONFIRMED" : "PENDING");
			if (record.rsvpLink) assertRsvpManagementLink_(record.rsvpLink, config.baseUrl);
			return { row, record, status };
		});
		const now = new Date();
		reconciled.forEach(result => {
			if (!result) return;
			result.row[5] = result.status;
			if (result.record.rsvpLink) result.row[4] = result.record.rsvpLink;
			result.row[6] = result.record.cancellationLink || "";
			result.row[8] = now;
			result.row[10] = now;
			summary.refreshed += 1;
			if (result.status === "CONFIRMED") summary.confirmed += 1;
			else if (result.status === "DECLINED") summary.declined += 1;
			else summary.pending += 1;
		});
		source.getRange(2, layout.start + 1, values.length, TRACK_RESPONSE_HEADERS.length).setValues(values);
		return summary;
	});
}

/** Visible menu wrapper with an operator-readable summary. */
function refreshResponseRsvpStatusFromMenu() {
	const result = refreshResponseRsvpStatus();
	SpreadsheetApp.getActive().toast(
		`Refreshed ${result.refreshed} RSVP response${result.refreshed === 1 ? "" : "s"}: ${result.confirmed} confirmed, ${result.declined} declined, ${result.pending} pending.`,
		"RSVP responses refreshed",
		10,
	);
	return result;
}

/** @param {number} maxRows */
function selectedResponseRows_(maxRows) {
	const sheet = SpreadsheetApp.getActiveSheet();
	if (sheet.getName() !== TRACK_RESPONSES_SHEET) throw new Error(`Open the ${TRACK_RESPONSES_SHEET} sheet first.`);
	const selection = sheet.getActiveRange();
	if (!selection) throw new Error("Select a participant row first.");
	const firstRow = selection.getRow();
	const rowCount = selection.getNumRows();
	if (firstRow < 2 || rowCount < 1 || rowCount > maxRows) throw new Error(`Select ${maxRows === 1 ? "one response row" : `1 to ${maxRows} response rows`}.`);
	return { sheet, firstRow, rowCount };
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {boolean} [initializeBlank] */
function ensureResponseColumns_(sheet, initializeBlank = false) {
	if (sheet.getName() !== TRACK_RESPONSES_SHEET) throw new Error(`Open the ${TRACK_RESPONSES_SHEET} sheet first.`);
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
		applyResponseColumnWidths_(sheet, start + 1);
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

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {{start: number}} layout @param {number} rowNumber @param {string[]} row @param {boolean} [persist] */
function responseParticipantId_(sheet, layout, rowNumber, row, persist = true) {
	const idColumn = layout.start + TRACK_RESPONSE_HEADERS.indexOf("Participant ID") + 1;
	const current = String(row[idColumn - 1] || "").trim();
	const id = current || createParticipantId_();
	if (!current && persist) sheet.getRange(rowNumber, idColumn).setValue(id);
	return id;
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {{start: number}} layout @param {number} rowNumber @param {string} expectedId */
function assertResponseParticipantId_(sheet, layout, rowNumber, expectedId) {
	const idColumn = layout.start + TRACK_RESPONSE_HEADERS.indexOf("Participant ID") + 1;
	const current = String(sheet.getRange(rowNumber, idColumn).getValues()[0]?.[0] || "").trim();
	if (current !== expectedId) throw new Error(`Participant ID changed for response row ${rowNumber}. Retry the operation.`);
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

/**
 * @template T
 * @param {() => T} operation
 * @returns {T}
 */
function withDocumentLock_(operation) {
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
