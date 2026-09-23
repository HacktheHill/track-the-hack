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
/** @typedef {{sourceRow: number, submissionId: string, record: OperationalRecord}} AcceptedApplication */
/** @typedef {OperationalRecord | {hackers: OperationalRecord[]} | {ids: string[]}} ApiPayload */

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
			row[0], "", "", "", row[1], row[2], row[3], row[4], row[5], "",
		]);
		const requiredColumns = start + TRACK_RESPONSE_HEADERS.length;
		if (sheet.getMaxColumns() < requiredColumns) sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
		sheet.getRange(1, start + 1, lastRow, TRACK_RESPONSE_HEADERS.length).setValues(next);
		return lastRow - 1;
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
		const layout = ensureResponseColumns_(source);
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

/**
 * Invoke this from the RSVP/email preparation process before sending links.
 * It intentionally is not a sidebar action or an automatic edit trigger.
 * @returns {number}
 */
function prepareSelectedRowsForRsvp() {
	const config = trackConfig_();
	return withOperationsLock_(() => {
		const selected = selectedResponseRows_(500);
		const source = selected.sheet;
		const layout = ensureResponseColumns_(source);
		const rows = source.getRange(selected.firstRow, 1, selected.rowCount, source.getLastColumn()).getDisplayValues();
		/** @type {OperationalRecord[]} */
		const records = [];
		/** @type {Set<string>} */
		const submissions = new Set();
		rows.forEach((row, offset) => {
			assertAccepted_(layout.headers, row);
			const submissionId = requiredCell_(layout.headers, row, ["Submission ID"]);
			if (submissions.has(submissionId)) throw new Error(`Duplicate Submission ID in selection: ${submissionId}`);
			submissions.add(submissionId);
			const rowNumber = selected.firstRow + offset;
			const participantId = responseParticipantId_(source, layout, rowNumber, row, submissionId);
			const record = applicationRowToOperationalRecord_(
				layout.headers,
				row,
				participantId,
				config.deadline,
				booleanCell_(row[layout.start + TRACK_RESPONSE_HEADERS.indexOf("Walk-In")]),
			);
			writeResponseRecord_(source, layout, rowNumber, record);
			records.push(record);
		});
		SpreadsheetApp.flush();
		const result = processedResponse_(apiPost_(config, "/api/integrations/sheets/hackers", { hackers: records }));
		if (result.processed !== records.length) throw new Error("Tracker did not confirm every participant. Retry the same rows.");
		const reconciliation = rsvpReconciliationResponse_(
			apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", { ids: records.map(record => record.id) }),
		);
		if (reconciliation.missingIds.length) throw new Error("Tracker could not find every provisioned participant. Retry the same rows.");
		const byId = new Map(reconciliation.records.map(record => [record.id, record]));
		records.forEach((record, offset) => {
			const result = byId.get(record.id);
			if (!result || !result.status || !result.rsvpLink) throw new Error("Tracker did not return an RSVP management link for every participant.");
			assertRsvpManagementLink_(result.rsvpLink, config.baseUrl);
			const rowNumber = selected.firstRow + offset;
			source.getRange(rowNumber, layout.start + TRACK_RESPONSE_HEADERS.indexOf("RSVP Link") + 1).setValue(result.rsvpLink);
			source.getRange(rowNumber, layout.start + TRACK_RESPONSE_HEADERS.indexOf("RSVP Status") + 1).setValue(result.status);
		});
		return result.processed;
	});
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

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet */
function ensureResponseColumns_(sheet) {
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
	if (current.every(value => !value)) {
		sheet.getRange(1, start + 1, 1, TRACK_RESPONSE_HEADERS.length).setValues([TRACK_RESPONSE_HEADERS]);
	} else if (current.join("\n") !== TRACK_RESPONSE_HEADERS.join("\n")) {
		throw new Error("Columns after Review reasoning do not match Tracker's response-row fields. No values were changed.");
	}
	return { headers, start };
}

/** @param {string[]} headers @param {string[]} row */
function assertAccepted_(headers, row) {
	const status = requiredCell_(headers, row, ["Admission status"]);
	if (!/^(accepted|accepté|acceptée)$/i.test(status)) throw new Error("This row must have Admission status Accepted before issuing a pass.");
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sheet @param {{start: number}} layout @param {number} rowNumber @param {string[]} row @param {string} submissionId */
function responseParticipantId_(sheet, layout, rowNumber, row, submissionId) {
	const idColumn = layout.start + TRACK_RESPONSE_HEADERS.indexOf("Participant ID") + 1;
	const current = String(row[idColumn - 1] || "").trim();
	const legacy = SpreadsheetApp.getActive().getSheetByName(TRACK_OPERATIONS_SHEET);
	const oldId = legacy ? existingParticipantsBySubmission_(legacy).get(submissionId) : undefined;
	if (current && oldId && current !== oldId) throw new Error(`Conflicting participant IDs for Submission ID: ${submissionId}`);
	const id = current || oldId || createParticipantId_();
	if (!current) sheet.getRange(rowNumber, idColumn).setValue(id);
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
	// The ID-only link is retired. Only reconciliation may populate a signed link.
	existing[4] = "";
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
	acceptSelectedApplications_(false);
}

function acceptSelectedWalkInApplications() {
	acceptSelectedApplications_(true);
}

/** @param {boolean} walkIn */
function acceptSelectedApplications_(walkIn) {
	const config = trackConfig_();
	const source = SpreadsheetApp.getActiveSheet();
	if (source.getName() === TRACK_OPERATIONS_SHEET) {
		throw new Error("Select application rows on the Tally response sheet first.");
	}

	const selection = source.getActiveRange();
	if (!selection) throw new Error("Select one or more application rows first.");
	const firstRow = Math.max(2, selection.getRow());
	const rowCount = selection.getLastRow() - firstRow + 1;
	if (rowCount < 1 || rowCount > 500) throw new Error("Select between 1 and 500 application rows.");

	const columnCount = source.getLastColumn();
	const headers = source.getRange(1, 1, 1, columnCount).getDisplayValues()[0];
	if (!headers) throw new Error("The Tally response sheet has no header row.");
	const rows = source.getRange(firstRow, 1, rowCount, columnCount).getDisplayValues();
	const processed = withOperationsLock_(() => {
		const operations = ensureOperationsSheet_();
		const existing = existingParticipantsBySubmission_(operations);
		/** @type {Set<string>} */
		const selected = new Set();
		/** @type {AcceptedApplication[]} */
		const accepted = rows.map((row, offset) => {
			const submissionId = requiredCell_(headers, row, ["Submission ID"]);
			if (selected.has(submissionId)) throw new Error(`Duplicate Submission ID in selection: ${submissionId}`);
			selected.add(submissionId);
			const participantId = existing.get(submissionId) || createParticipantId_();
			return {
				sourceRow: firstRow + offset,
				submissionId,
				record: applicationRowToOperationalRecord_(headers, row, participantId, config.deadline, walkIn),
			};
		});

		// Commit the Sheet-owned IDs before any server write. A failed request
		// can then be retried with the same IDs, including after partial success.
		upsertOperations_(operations, accepted, config.baseUrl);
		SpreadsheetApp.flush();
		const result = processedResponse_(
			apiPost_(config, "/api/integrations/sheets/hackers", {
				hackers: accepted.map(item => item.record),
			}),
		);
		if (result.processed !== accepted.length) {
			throw new Error("Tracker API did not confirm the full batch. Retry the same selection.");
		}
		upsertOperations_(operations, accepted, config.baseUrl, new Date());
		return result.processed;
	});
	// Dialogs suspend execution and do not preserve locks.
	SpreadsheetApp.getUi().alert(`${processed} participant(s) provisioned.`);
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
	const selections = headers.flatMap((header, index) => {
		const value = String(row[index] || "").trim();
		if (!value || /^(false|no|non|none|n\/a|aucun.*)$/i.test(value)) return [];
		if (
			header !== "Select all that apply." &&
			!/(diet|food|allerg|restriction alimentaire|végétar|végétal|halal|casher|cœliaque|gluten|intolérance|arachide|lait|œuf|blé|soja|sésame|poisson|mollusque|sulfite|mustard|peanut|sesame|soy|wheat|fish|milk|egg|nut)/i.test(
				header,
			)
		)
			return [];
		return [`${header} ${value}`];
	});
	const combined = selections.join(" ");
	if (/vegan|végétalien/i.test(combined)) return "VEGAN";
	if (/vegetarian|végétarien/i.test(combined)) return "VEGETARIAN";
	if (/halal/i.test(combined)) return "HALAL";
	return selections.length ? "OTHER" : "STANDARD";
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

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {AcceptedApplication[]} accepted
 * @param {string} baseUrl
 * @param {Date | null} [syncedAt]
 */
function upsertOperations_(sheet, accepted, baseUrl, syncedAt = null) {
	const rows =
		sheet.getLastRow() < 2
			? []
			: sheet.getRange(2, 1, sheet.getLastRow() - 1, TRACK_OPERATION_HEADERS.length).getValues();
	const sourceColumn = TRACK_OPERATION_HEADERS.indexOf("Source Submission ID");
	/** @type {Map<string, number>} */
	const rowBySubmission = new Map();
	rows.forEach((row, index) => {
		if (row[sourceColumn]) rowBySubmission.set(String(row[sourceColumn]), index + 2);
	});

	accepted.forEach(item => {
		const previousRow = rowBySubmission.get(item.submissionId);
		const previous = previousRow
			? sheet.getRange(previousRow, 1, 1, TRACK_OPERATION_HEADERS.length).getValues()[0]
			: [];
		if (!previous) throw new Error("The existing operations row could not be read.");
		/** @param {string} header */
		const value = header => previous[TRACK_OPERATION_HEADERS.indexOf(header)] || "";
		const previousStatus = value("RSVP Status");
		const status = syncedAt && (!previousStatus || previousStatus === "MISSING") ? "PENDING" : previousStatus;
		const next = [
			item.submissionId,
			item.sourceRow,
			item.record.id,
			item.record.tShirtSize,
			item.record.mealCategory,
			new Date(item.record.acceptanceExpiry),
			`${baseUrl}/rsvp/${encodeURIComponent(item.record.id)}`,
			status,
			value("Cancellation Link"),
			value("Access Expires"),
			syncedAt || value("Last Sync"),
			item.record.walkIn,
		];
		const targetRow = previousRow || sheet.getLastRow() + 1;
		sheet.getRange(targetRow, 1, 1, TRACK_OPERATION_HEADERS.length).setValues([next]);
		rowBySubmission.set(item.submissionId, targetRow);
	});
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
