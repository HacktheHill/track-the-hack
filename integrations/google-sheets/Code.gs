/** @OnlyCurrentDoc */

/** @typedef {"XS" | "S" | "M" | "L" | "XL" | "XXL" | "NONE"} TShirtSize */
/** @typedef {"STANDARD" | "VEGETARIAN" | "VEGAN" | "HALAL" | "OTHER"} MealCategory */
/** @typedef {string | number | boolean | Date} SheetCell */
/** @typedef {SheetCell[]} SheetRow */
/** @typedef {{id: string, tShirtSize: TShirtSize, mealCategory: MealCategory, acceptanceExpiry: string, walkIn: boolean}} OperationalRecord */
/** @typedef {{baseUrl: string, apiKey: string, deadline: string}} TrackConfig */
/** @typedef {{id: string, confirmed: boolean, cancellationLink?: string}} RsvpRecord */
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
};

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
		.addItem("Set up operations tab", "setupTrackOperations")
		.addItem("Accept selected application(s)", "acceptSelectedApplications")
		.addItem("Accept selected walk-in application(s)", "acceptSelectedWalkInApplications")
		.addItem("Refresh RSVP status", "refreshRsvpStatus")
		.addItem("Issue access for selected participant", "issueAccessForSelectedParticipant")
		.addToUi();
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
	if (!lock) throw new Error("Run Track operations from the bound Google Sheet.");
	if (!lock.tryLock(30000)) throw new Error("Another Track operation is running. Try again shortly.");
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
			throw new Error("Track API did not confirm the full batch. Retry the same selection.");
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
			throw new Error(`Track API did not return a reconciliation result for ${id}.`);
		}
		const record = byId[id];
		if (record === undefined) throw new Error(`Track API returned an invalid reconciliation result for ${id}.`);
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
		throw new Error("Track API returned an invalid claim URL.");
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
	if (!/^https:\/\//.test(baseUrl) || !apiKey || !deadline) {
		throw new Error(
			"Set an HTTPS TRACK_BASE_URL, SHEETS_INTEGRATION_API_KEY, and RSVP_DEADLINE in Apps Script project properties.",
		);
	}
	return { baseUrl, apiKey, deadline: isoDate_(deadline) };
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
		headers: { Authorization: `Bearer ${config.apiKey}` },
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	});
	const status = response.getResponseCode();
	const body = response.getContentText();
	if (status < 200 || status >= 300) throw new Error(`Track API ${status}: ${body.slice(0, 500)}`);
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
		throw new Error("Track API returned an invalid processed response.");
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
		throw new Error("Track API returned an invalid RSVP reconciliation response.");
	}
	const records = value.records;
	const missingIds = value.missingIds;
	if (!Array.isArray(records) || !Array.isArray(missingIds) || !missingIds.every(id => typeof id === "string")) {
		throw new Error("Track API returned an invalid RSVP reconciliation response.");
	}

	const parsedRecords = records.map(record => {
		if (record === null || Array.isArray(record) || typeof record !== "object") {
			throw new Error("Track API returned an invalid RSVP reconciliation record.");
		}
		const { id, confirmed, cancellationLink } = record;
		if (
			typeof id !== "string" ||
			typeof confirmed !== "boolean" ||
			(cancellationLink !== undefined && typeof cancellationLink !== "string")
		) {
			throw new Error("Track API returned an invalid RSVP reconciliation record.");
		}
		return cancellationLink === undefined ? { id, confirmed } : { id, confirmed, cancellationLink };
	});
	return { records: parsedRecords, missingIds };
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
		throw new Error("Track API returned an invalid claim response.");
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
