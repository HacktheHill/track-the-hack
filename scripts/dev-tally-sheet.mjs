import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

/**
 * @typedef {object} TallySubmission
 * @property {string} submissionId
 * @property {string} email
 * @property {string} fullName
 * @property {boolean} waiverSigned
 * @property {string} dietaryDetails
 * @property {Record<string, string>} sheetValues
 * @property {boolean} walkIn
 */

/**
 * @typedef {object} SheetReview
 * @property {string} submissionId
 * @property {"ACCEPTED" | "REJECTED"} decision
 * @property {string | null} participantId
 * @property {number} acceptanceDays
 */

/** @typedef {{ tallySubmissions: TallySubmission[], sheetReviews: SheetReview[] }} TallySheetFixture */
/** @typedef {TallySubmission & SheetReview} ReviewedSheetRow */

const appsScriptSource = readFileSync(new URL("../integrations/google-sheets/Code.gs", import.meta.url), "utf8");
const { applicationRowToOperationalRecord_ } = runInNewContext(
	`${appsScriptSource}\n({ applicationRowToOperationalRecord_ })`,
);

/**
 * @param {URL} fixtureUrl
 * @returns {Promise<TallySheetFixture>}
 */
export const loadTallySheetFixture = async fixtureUrl =>
	/** @type {TallySheetFixture} */ (JSON.parse(await readFile(fixtureUrl, "utf8")));

/**
 * @param {TallySheetFixture} fixture
 * @returns {ReviewedSheetRow[]}
 */
export const syncTallyFixtureToSheet = fixture => {
	/** @type {Map<string, SheetReview>} */
	const reviews = new Map();
	for (const review of fixture.sheetReviews) {
		if (reviews.has(review.submissionId)) throw new Error(`Duplicate Sheet review: ${review.submissionId}`);
		reviews.set(review.submissionId, review);
	}

	return fixture.tallySubmissions.map(submission => {
		const review = reviews.get(submission.submissionId);
		if (!review) throw new Error(`Missing Sheet review: ${submission.submissionId}`);
		return { ...submission, ...review };
	});
};

/**
 * @param {ReviewedSheetRow[]} rows
 * @param {{ now?: number, participantIdFor?: (row: ReviewedSheetRow) => string }} options
 */
export const acceptedSheetRowsToOperationalRecords = (
	rows,
	{
		now = Date.now(),
		participantIdFor = row => {
			if (!row.participantId) throw new Error(`Accepted Sheet row needs a participant ID: ${row.submissionId}`);
			return row.participantId;
		},
	} = {},
) =>
	rows
		.filter(row => row.decision === "ACCEPTED")
		.map(row => {
			const headers = Object.keys(row.sheetValues);
			const values = headers.map(header => row.sheetValues[header] ?? "");
			const record = applicationRowToOperationalRecord_(
				headers,
				values,
				participantIdFor(row),
				new Date(now + row.acceptanceDays * 24 * 60 * 60 * 1000).toISOString(),
				row.walkIn,
			);
			return JSON.parse(JSON.stringify(record));
		});
