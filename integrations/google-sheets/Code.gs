/** @OnlyCurrentDoc */

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
	const sheet = ensureOperationsSheet_();
	SpreadsheetApp.getActive().setActiveSheet(sheet);
}

function acceptSelectedApplications() {
	acceptSelectedApplications_(false);
}

function acceptSelectedWalkInApplications() {
	acceptSelectedApplications_(true);
}

function acceptSelectedApplications_(walkIn) {
	const config = trackConfig_();
	const source = SpreadsheetApp.getActiveSheet();
	if (source.getName() === TRACK_OPERATIONS_SHEET) {
		throw new Error("Select application rows on the Tally response sheet first.");
	}

	const selection = source.getActiveRange();
	const firstRow = Math.max(2, selection.getRow());
	const rowCount = selection.getLastRow() - firstRow + 1;
	if (rowCount < 1 || rowCount > 500) throw new Error("Select between 1 and 500 application rows.");

	const columnCount = source.getLastColumn();
	const headers = source.getRange(1, 1, 1, columnCount).getDisplayValues()[0];
	const rows = source.getRange(firstRow, 1, rowCount, columnCount).getDisplayValues();
	const operations = ensureOperationsSheet_();
	const existing = existingParticipantsBySubmission_(operations);

	const accepted = rows.map((row, offset) => {
		const submissionId = requiredCell_(headers, row, ["Submission ID"]);
		const participantId = existing[submissionId] || createParticipantId_();
		return {
			sourceRow: firstRow + offset,
			submissionId,
			record: applicationRowToOperationalRecord_(headers, row, participantId, config.deadline, walkIn),
		};
	});

	apiPost_(config, "/api/integrations/sheets/hackers", {
		hackers: accepted.map(item => item.record),
	});
	upsertOperations_(operations, accepted, config.baseUrl);
	SpreadsheetApp.getUi().alert(`${accepted.length} participant(s) provisioned.`);
}

function refreshRsvpStatus() {
	const config = trackConfig_();
	const sheet = ensureOperationsSheet_();
	const lastRow = sheet.getLastRow();
	if (lastRow < 2) throw new Error("There are no accepted participants to reconcile.");

	const rows = sheet.getRange(2, 1, lastRow - 1, TRACK_OPERATION_HEADERS.length).getValues();
	const idColumn = TRACK_OPERATION_HEADERS.indexOf("Participant ID");
	const ids = rows.map(row => String(row[idColumn] || "")).filter(Boolean);
	if (!ids.length) throw new Error("There are no participant IDs to reconcile.");
	const byId = {};

	for (let offset = 0; offset < ids.length; offset += 500) {
		const response = apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", {
			ids: ids.slice(offset, offset + 500),
		});
		response.records.forEach(record => (byId[record.id] = record));
		response.missingIds.forEach(id => (byId[id] = null));
	}

	const now = new Date();
	applyRsvpReconciliation_(rows, byId, now);
	sheet.getRange(2, 1, rows.length, TRACK_OPERATION_HEADERS.length).setValues(rows);
	SpreadsheetApp.getUi().alert(`${ids.length} participant(s) reconciled.`);
}

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
	if (sheet.getName() !== TRACK_OPERATIONS_SHEET || selection.getRow() < 2 || selection.getNumRows() !== 1) {
		throw new Error("Select one participant row on the Track Operations sheet.");
	}

	const rowNumber = selection.getRow();
	const row = sheet.getRange(rowNumber, 1, 1, TRACK_OPERATION_HEADERS.length).getValues()[0];
	const response = apiPost_(config, "/api/integrations/sheets/claim", operationalRecordFromRow_(row));
	sheet
		.getRange(rowNumber, TRACK_OPERATION_HEADERS.indexOf("Access Expires") + 1)
		.setValue(new Date(response.expiresAt));

	const displayUrl = claimDisplayUrl_(response.claimUrl);
	const html = HtmlService.createHtmlOutput(
		`<p>This access code expires in five minutes.</p><p><a href="${escapeHtml_(displayUrl)}" target="_blank">Open access QR</a></p>`,
	)
		.setWidth(360)
		.setHeight(140);
	SpreadsheetApp.getUi().showModalDialog(html, "Participant access");
}

function claimDisplayUrl_(claimUrl) {
	const value = String(claimUrl || "");
	const displayUrl = value.replace("/claim#", "/claim/qr#");
	if (displayUrl === value || !/^https:\/\//.test(displayUrl)) {
		throw new Error("Track API returned an invalid claim URL.");
	}
	return displayUrl;
}

function applicationRowToOperationalRecord_(headers, row, participantId, acceptanceExpiry, walkIn = false) {
	return {
		id: participantId,
		tShirtSize: tShirtSize_(headers, row),
		mealCategory: mealCategory_(headers, row),
		acceptanceExpiry: isoDate_(acceptanceExpiry),
		walkIn: Boolean(walkIn),
	};
}

function tShirtSize_(headers, row) {
	const raw = requiredCell_(headers, row, [
		"What unisex T-shirt size would you prefer?",
		"Quelle taille de t-shirt unisexe préférez-vous?",
	]).toUpperCase();
	const match = raw.match(/(?:^|\b)(XXL|2XL|XL|XS|L|M|S)(?:\b|$)/);
	if (!match) throw new Error(`Unsupported T-shirt size: ${raw}`);
	return match[1] === "2XL" ? "XXL" : match[1];
}

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

function requiredCell_(headers, row, names) {
	for (const name of names) {
		const index = headers.indexOf(name);
		const value = index === -1 ? "" : String(row[index] || "").trim();
		if (value) return value;
	}
	throw new Error(`Missing required Sheet value: ${names.join(" / ")}`);
}

function operationalRecordFromRow_(row) {
	const value = header => row[TRACK_OPERATION_HEADERS.indexOf(header)];
	return {
		id: String(value("Participant ID")),
		tShirtSize: String(value("T-Shirt Size")),
		mealCategory: String(value("Meal Category")),
		acceptanceExpiry: isoDate_(value("Acceptance Expires")),
		walkIn: booleanCell_(value("Walk-In")),
	};
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
	return JSON.parse(body);
}

function ensureOperationsSheet_() {
	const spreadsheet = SpreadsheetApp.getActive();
	const sheet = spreadsheet.getSheetByName(TRACK_OPERATIONS_SHEET) || spreadsheet.insertSheet(TRACK_OPERATIONS_SHEET);
	const current = sheet.getRange(1, 1, 1, TRACK_OPERATION_HEADERS.length).getDisplayValues()[0];
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

function existingParticipantsBySubmission_(sheet) {
	if (sheet.getLastRow() < 2) return {};
	const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, TRACK_OPERATION_HEADERS.length).getDisplayValues();
	const sourceColumn = TRACK_OPERATION_HEADERS.indexOf("Source Submission ID");
	const idColumn = TRACK_OPERATION_HEADERS.indexOf("Participant ID");
	return rows.reduce((result, row) => {
		if (row[sourceColumn] && row[idColumn]) result[row[sourceColumn]] = row[idColumn];
		return result;
	}, {});
}

function upsertOperations_(sheet, accepted, baseUrl) {
	const rows =
		sheet.getLastRow() < 2
			? []
			: sheet.getRange(2, 1, sheet.getLastRow() - 1, TRACK_OPERATION_HEADERS.length).getValues();
	const sourceColumn = TRACK_OPERATION_HEADERS.indexOf("Source Submission ID");
	const rowBySubmission = rows.reduce((result, row, index) => {
		if (row[sourceColumn]) result[String(row[sourceColumn])] = index + 2;
		return result;
	}, {});

	accepted.forEach(item => {
		const previousRow = rowBySubmission[item.submissionId];
		const previous = previousRow
			? sheet.getRange(previousRow, 1, 1, TRACK_OPERATION_HEADERS.length).getValues()[0]
			: [];
		const value = header => previous[TRACK_OPERATION_HEADERS.indexOf(header)] || "";
		const next = [
			item.submissionId,
			item.sourceRow,
			item.record.id,
			item.record.tShirtSize,
			item.record.mealCategory,
			new Date(item.record.acceptanceExpiry),
			`${baseUrl}/rsvp/${encodeURIComponent(item.record.id)}`,
			value("RSVP Status") || "PENDING",
			value("Cancellation Link"),
			value("Access Expires"),
			new Date(),
			item.record.walkIn,
		];
		const targetRow = previousRow || sheet.getLastRow() + 1;
		sheet.getRange(targetRow, 1, 1, TRACK_OPERATION_HEADERS.length).setValues([next]);
	});
}

function createParticipantId_() {
	return `${Utilities.getUuid()}${Utilities.getUuid()}`.replace(/-/g, "");
}

function isoDate_(value) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid RSVP deadline: ${value}`);
	return date.toISOString();
}

function booleanCell_(value) {
	return value === true || /^(?:true|yes|oui|walk-in)$/i.test(String(value || "").trim());
}

function escapeHtml_(value) {
	return String(value).replace(
		/[&<>\"]/g,
		character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[character],
	);
}
