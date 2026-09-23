/** @OnlyCurrentDoc */

/** @typedef {"XS" | "S" | "M" | "L" | "XL" | "XXL" | "NONE"} TShirtSize */
/** @typedef {"STANDARD" | "VEGETARIAN" | "VEGAN" | "HALAL" | "OTHER"} MealCategory */
/** @typedef {string | number | boolean | Date} SheetCell */
/** @typedef {{id: string, tShirtSize: TShirtSize, mealCategory: MealCategory, acceptanceExpiry: string, walkIn: boolean}} OperationalRecord */
/** @typedef {{baseUrl: string, apiKey: string, deadline: string, accessClientId: string, accessClientSecret: string}} TrackConfig */
/** @typedef {{id: string, confirmed: boolean, cancellationLink?: string}} RsvpRecord */
/** @typedef {{records: RsvpRecord[], missingIds: string[]}} RsvpReconciliation */
/** @typedef {{claimUrl: string, expiresAt: string}} ClaimResponse */
/** @typedef {{displayUrl: string, expiresAt: string, rowNumber: number, rsvpStatus: string, warning: string}} ClaimDisplay */
/** @typedef {OperationalRecord | {ids: string[]}} ApiPayload */

const TRACK_RESPONSE_SHEET = "Responses";
const TRACK_ADMISSION_HEADER = "Admission status";
const TRACK_ACCEPTED_STATUSES = ["accepted", "accepté", "acceptée"];
const TRACK_PROPERTIES = {
	baseUrl: "TRACK_BASE_URL",
	apiKey: "SHEETS_INTEGRATION_API_KEY",
	deadline: "RSVP_DEADLINE",
	accessClientId: "CF_ACCESS_CLIENT_ID",
	accessClientSecret: "CF_ACCESS_CLIENT_SECRET",
};

const TRACK_RESPONSE_HEADERS = [
	"Track Participant ID",
	"Track RSVP Link",
	"Track RSVP Status",
	"Track Cancellation Link",
	"Track Access Expires",
	"Track Last Sync",
];

function onOpen() {
	SpreadsheetApp.getUi()
		.createMenu("Track the Hack")
		.addItem("Open check-in sidebar", "showCheckInSidebar")
		.addToUi();
}

function showCheckInSidebar() {
	withDocumentLock_(() => ensureResponseColumns_(responseSheet_()));
	const html = HtmlService.createHtmlOutputFromFile("Sidebar").setTitle("Track the Hack check-in");
	SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called asynchronously by the check-in sidebar. The selected response row is
 * the source of truth; the Track-owned participant ID is committed before the
 * API request so every retry reuses the same participant.
 * @returns {ClaimDisplay}
 */
function provisionSelectedParticipantAndIssueAccess() {
	const config = trackConfig_();
	return withDocumentLock_(() => {
		const sheet = responseSheet_();
		const selection = sheet.getActiveRange();
		if (!selection || selection.getRow() < 2 || selection.getNumRows() !== 1) {
			throw new Error("Select one applicant row on the Responses sheet.");
		}

		const rowNumber = selection.getRow();
		const headers = ensureResponseColumns_(sheet);
		const headerMap = headerMap_(headers);
		const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
		if (!row) throw new Error("The selected response row is empty.");

		const submissionId = requiredValue_(headerMap, row, ["Submission ID"]);
		const admissionStatus = requiredValue_(headerMap, row, [TRACK_ADMISSION_HEADER]).toLocaleLowerCase();
		if (!TRACK_ACCEPTED_STATUSES.includes(admissionStatus)) {
			throw new Error(
				`Submission ${submissionId} is not accepted. Set ${TRACK_ADMISSION_HEADER} to Accepted before issuing access.`,
			);
		}

		const participantColumn = requiredHeaderIndex_(headerMap, "Track Participant ID");
		const participantId = String(row[participantColumn] || "").trim() || createParticipantId_();
		const record = applicationRowToOperationalRecord_(headers, row, participantId, config.deadline, false);
		const rsvpUrl = `${config.baseUrl}/rsvp/${encodeURIComponent(participantId)}`;

		// Save the mapping before the network request. A timeout or partial failure
		// can then be retried without creating a second participant.
		writeResponseValue_(sheet, rowNumber, headerMap, "Track Participant ID", participantId);
		writeResponseValue_(sheet, rowNumber, headerMap, "Track RSVP Link", rsvpUrl);
		SpreadsheetApp.flush();

		const claim = claimResponse_(apiPost_(config, "/api/integrations/sheets/claim", record));
		writeResponseValue_(sheet, rowNumber, headerMap, "Track Access Expires", new Date(claim.expiresAt));

		let rsvpStatus = String(row[requiredHeaderIndex_(headerMap, "Track RSVP Status")] || "").trim();
		let warning = "";
		try {
			const reconciliation = rsvpReconciliationResponse_(
				apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", { ids: [participantId] }),
			);
			const result = reconciliation.records.find(record => record.id === participantId);
			if (result) {
				rsvpStatus = result.confirmed ? "CONFIRMED" : "PENDING";
				writeResponseValue_(
					sheet,
					rowNumber,
					headerMap,
					"Track Cancellation Link",
					result.cancellationLink || "",
				);
			} else if (reconciliation.missingIds.includes(participantId)) {
				rsvpStatus = "MISSING";
				writeResponseValue_(sheet, rowNumber, headerMap, "Track Cancellation Link", "");
			} else {
				throw new Error("Track API omitted the selected participant.");
			}
			writeResponseValue_(sheet, rowNumber, headerMap, "Track RSVP Status", rsvpStatus);
			writeResponseValue_(sheet, rowNumber, headerMap, "Track Last Sync", new Date());
		} catch (_error) {
			warning = "The QR was issued, but RSVP status could not be refreshed.";
		}

		return {
			displayUrl: claimDisplayUrl_(claim.claimUrl, claim.expiresAt),
			expiresAt: claim.expiresAt,
			rowNumber,
			rsvpStatus,
			warning,
		};
	});
}

/**
 * @template T
 * @param {() => T} operation
 * @returns {T}
 */
function withDocumentLock_(operation) {
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

function responseSheet_() {
	const sheet = SpreadsheetApp.getActiveSheet();
	if (!sheet || sheet.getName() !== TRACK_RESPONSE_SHEET) {
		throw new Error(`Select an applicant row on the ${TRACK_RESPONSE_SHEET} sheet.`);
	}
	return sheet;
}

/**
 * Append missing Track-owned headers without moving or overwriting Tally and
 * admissions columns. Existing headers may move; all reads and writes resolve
 * their current positions by name.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {string[]}
 */
function ensureResponseColumns_(sheet) {
	let lastColumn = sheet.getLastColumn();
	if (lastColumn < 1) throw new Error("The Responses sheet has no header row.");
	let headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] || [];
	if (!headers.length) throw new Error("The Responses header row could not be read.");
	headerMap_(headers);

	const missing = TRACK_RESPONSE_HEADERS.filter(header => !headers.includes(header));
	if (missing.length) {
		const requiredColumns = lastColumn + missing.length;
		const availableColumns = sheet.getMaxColumns();
		if (requiredColumns > availableColumns) {
			sheet.insertColumnsAfter(availableColumns, requiredColumns - availableColumns);
		}
		sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
		lastColumn = requiredColumns;
		headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] || [];
		if (!headers.length) throw new Error("The updated Responses header row could not be read.");
	}

	const map = headerMap_(headers);
	for (const header of ["Submission ID", TRACK_ADMISSION_HEADER, ...TRACK_RESPONSE_HEADERS]) {
		if (headers.filter(value => value === header).length !== 1) {
			throw new Error(`Expected exactly one Sheet header: ${header}`);
		}
		requiredHeaderIndex_(map, header);
	}
	return headers;
}

/** @param {string[]} headers */
function headerMap_(headers) {
	/** @type {Map<string, number>} */
	const map = new Map();
	headers.forEach((header, index) => {
		const name = String(header || "").trim();
		if (!name) return;
		if (!map.has(name)) map.set(name, index);
	});
	return map;
}

/** @param {Map<string, number>} headers @param {string} name */
function requiredHeaderIndex_(headers, name) {
	const index = headers.get(name);
	if (index === undefined) throw new Error(`Missing required Sheet header: ${name}`);
	return index;
}

/**
 * @param {Map<string, number>} headers
 * @param {SheetCell[]} row
 * @param {string[]} names
 */
function requiredValue_(headers, row, names) {
	for (const name of names) {
		const index = headers.get(name);
		const value = index === undefined ? "" : String(row[index] || "").trim();
		if (value) return value;
	}
	throw new Error(`Missing required Sheet value: ${names.join(" / ")}`);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} row
 * @param {Map<string, number>} headers
 * @param {string} header
 * @param {SheetCell} value
 */
function writeResponseValue_(sheet, row, headers, header, value) {
	sheet.getRange(row, requiredHeaderIndex_(headers, header) + 1).setValue(value);
}

/**
 * @param {string[]} headers
 * @param {SheetCell[]} row
 * @param {string} participantId
 * @param {string | Date} acceptanceExpiry
 * @param {boolean} [walkIn]
 * @returns {OperationalRecord}
 */
function applicationRowToOperationalRecord_(headers, row, participantId, acceptanceExpiry, walkIn = false) {
	const map = headerMap_(headers);
	return {
		id: participantId,
		tShirtSize: tShirtSize_(map, row),
		mealCategory: mealCategory_(headers, row),
		acceptanceExpiry: isoDate_(acceptanceExpiry),
		walkIn: Boolean(walkIn),
	};
}

/** @param {Map<string, number>} headers @param {SheetCell[]} row @returns {TShirtSize} */
function tShirtSize_(headers, row) {
	const raw = requiredValue_(headers, row, [
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

/** @param {string[]} headers @param {SheetCell[]} row @returns {MealCategory} */
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

function trackConfig_() {
	const properties = PropertiesService.getScriptProperties();
	const baseUrl = String(properties.getProperty(TRACK_PROPERTIES.baseUrl) || "").replace(/\/$/, "");
	const apiKey = String(properties.getProperty(TRACK_PROPERTIES.apiKey) || "");
	const deadline = String(properties.getProperty(TRACK_PROPERTIES.deadline) || "");
	const accessClientId = String(properties.getProperty(TRACK_PROPERTIES.accessClientId) || "");
	const accessClientSecret = String(properties.getProperty(TRACK_PROPERTIES.accessClientSecret) || "");
	if (!/^https:\/\//.test(baseUrl) || !apiKey || !deadline || !accessClientId || !accessClientSecret) {
		throw new Error(
			"Set an HTTPS TRACK_BASE_URL, SHEETS_INTEGRATION_API_KEY, RSVP_DEADLINE, CF_ACCESS_CLIENT_ID, and CF_ACCESS_CLIENT_SECRET in Apps Script project properties.",
		);
	}
	return { baseUrl, apiKey, deadline: isoDate_(deadline), accessClientId, accessClientSecret };
}

/** @param {TrackConfig} config @param {string} path @param {ApiPayload} payload @returns {string} */
function apiPost_(config, path, payload) {
	const response = UrlFetchApp.fetch(`${config.baseUrl}${path}`, {
		method: "post",
		contentType: "application/json",
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"CF-Access-Client-Id": config.accessClientId,
			"CF-Access-Client-Secret": config.accessClientSecret,
		},
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	});
	const status = response.getResponseCode();
	const body = response.getContentText();
	if (status < 200 || status >= 300) throw new Error(`Track API ${status}: ${body.slice(0, 500)}`);
	return body;
}

/** @param {string} body @returns {RsvpReconciliation} */
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

/** @param {string} body @returns {ClaimResponse} */
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

/** @param {string} claimUrl @param {string} expiresAt */
function claimDisplayUrl_(claimUrl, expiresAt) {
	const value = String(claimUrl || "");
	const displayUrl = value.replace("/claim#", `/claim/qr?expiresAt=${encodeURIComponent(isoDate_(expiresAt))}#`);
	if (displayUrl === value || !/^https:\/\//.test(displayUrl)) {
		throw new Error("Track API returned an invalid claim URL.");
	}
	return displayUrl;
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
