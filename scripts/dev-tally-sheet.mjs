import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { z } from "zod";

const tallySubmissionSchema = z
	.object({
		submissionId: z.string().min(1),
		email: z.string().email(),
		fullName: z.string().min(1),
		waiverSigned: z.boolean(),
		dietaryDetails: z.string(),
		sheetValues: z.record(z.string()),
		walkIn: z.boolean(),
	})
	.strict();
const sheetReviewSchema = z
	.object({
		submissionId: z.string().min(1),
		decision: z.enum(["ACCEPTED", "REJECTED"]),
		participantId: z.string().min(1).nullable(),
		acceptanceDays: z.number().int().nonnegative(),
	})
	.strict();
const tallySheetFixtureSchema = z
	.object({
		tallySubmissions: z.array(tallySubmissionSchema),
		sheetReviews: z.array(sheetReviewSchema),
	})
	.strict();
const operationalRecordSchema = z
	.object({
		id: z.string().min(1),
		tShirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL", "NONE"]),
		mealCategory: z.enum(["STANDARD", "VEGETARIAN", "VEGAN", "HALAL", "OTHER"]),
		acceptanceExpiry: z.string().datetime(),
		walkIn: z.boolean(),
	})
	.strict();

/** @typedef {z.infer<typeof tallySubmissionSchema>} TallySubmission */
/** @typedef {z.infer<typeof sheetReviewSchema>} SheetReview */
/** @typedef {z.infer<typeof tallySheetFixtureSchema>} TallySheetFixture */
/** @typedef {TallySubmission & SheetReview} ReviewedSheetRow */

const appsScriptSource = readFileSync(new URL("../integrations/google-sheets/Code.gs", import.meta.url), "utf8");
const appsScriptAdapterSchema = z.object({
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
});
const { applicationRowToOperationalRecord_ } = appsScriptAdapterSchema.parse(
	runInNewContext(`${appsScriptSource}\n({ applicationRowToOperationalRecord_ })`),
);

/**
 * @param {URL} fixtureUrl
 * @returns {Promise<TallySheetFixture>}
 */
export const loadTallySheetFixture = async fixtureUrl =>
	tallySheetFixtureSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")));

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
			return record;
		});
