import {
	acceptedSheetRowsToOperationalRecords,
	loadTallySheetFixture,
	syncTallyFixtureToSheet,
} from "./dev-tally-sheet.mjs";
import { deliverLocalParticipantEmail } from "./dev-email.mjs";
import { z } from "zod";

/** @typedef {ReturnType<typeof acceptedSheetRowsToOperationalRecords>[number]} OperationalRecord */
/** @typedef {OperationalRecord | {hackers: OperationalRecord[]} | {ids: string[]}} ParticipantRequest */

const processedResponseSchema = z.object({ processed: z.number().int().nonnegative() }).strict();
const httpUrlSchema = z
	.string()
	.url()
	.refine(value => new Set(["http:", "https:"]).has(new URL(value).protocol), "Expected an HTTP(S) URL");
const reconciliationResponseSchema = z
	.object({
		records: z.array(
			z
				.object({
					id: z.string().min(1),
					confirmed: z.boolean(),
					cancellationLink: httpUrlSchema.optional(),
				})
				.strict(),
		),
		missingIds: z.array(z.string()),
	})
	.strict();
const claimResponseSchema = z.object({ claimUrl: httpUrlSchema, expiresAt: z.string().datetime() }).strict();

const command = process.argv[2] ?? "rsvp";
const baseUrl = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
const apiKey = process.env.SHEETS_INTEGRATION_API_KEY;

if (!apiKey) throw new Error("Run npm run dev:setup first so the local Sheet API key exists.");

const fixture = await loadTallySheetFixture(new URL("../test/fixtures/dev-tally-sheet.json", import.meta.url));
const acceptedRecords = acceptedSheetRowsToOperationalRecords(syncTallyFixtureToSheet(fixture));
const participants = {
	normal: acceptedRecords.find(record => !record.walkIn),
	walkIn: acceptedRecords.find(record => record.walkIn),
};
if (!participants.normal || !participants.walkIn) throw new Error("The dev fixture needs normal and walk-in records.");

/**
 * @template T
 * @param {string} path
 * @param {ParticipantRequest} body
 * @param {z.ZodType<T>} responseSchema
 * @returns {Promise<T>}
 */
const post = async (path, body, responseSchema) => {
	const response = await fetch(new URL(path, baseUrl), {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
	return responseSchema.parse(await response.json());
};

try {
	switch (command) {
		case "rsvp": {
			await post("/api/integrations/sheets/hackers", { hackers: [participants.normal] }, processedResponseSchema);
			const email = await deliverLocalParticipantEmail({
				type: "invitation",
				link: new URL(`/rsvp/${participants.normal.id}`, baseUrl).href,
			});
			console.info(`Invitation email delivered through local SMTP: ${email.file}`);
			const invitationLink = email.links[0];
			if (!invitationLink) throw new Error("The captured invitation email did not contain its RSVP link.");
			console.info(`RSVP link: ${invitationLink}`);
			break;
		}
		case "reconcile": {
			const result = await post(
				"/api/integrations/sheets/rsvp-reconciliation",
				{ ids: [participants.normal.id] },
				reconciliationResponseSchema,
			);
			const participant = result.records[0];
			console.info(`RSVP status: ${participant?.confirmed ? "confirmed" : "not confirmed"}`);
			if (participant?.cancellationLink) {
				const email = await deliverLocalParticipantEmail({
					type: "confirmation",
					link: participant.cancellationLink,
				});
				console.info(`Confirmation email delivered through local SMTP: ${email.file}`);
				const cancellationLink = email.links[0];
				if (!cancellationLink)
					throw new Error("The captured confirmation email did not contain its cancellation link.");
				console.info(`Cancellation link: ${cancellationLink}`);
			} else {
				console.info(
					"Confirm the RSVP in the browser, then rerun this command to receive its cancellation email.",
				);
			}
			break;
		}
		case "claim":
		case "walk-in": {
			const participant = command === "walk-in" ? participants.walkIn : participants.normal;
			const result = await post("/api/integrations/sheets/claim", participant, claimResponseSchema);
			console.info(`Simulated Sheet claim link: ${result.claimUrl}`);
			console.info(`Scanner input: ${participant.id}`);
			break;
		}
		default:
			throw new Error("Usage: npm run dev:participant -- rsvp|reconcile|claim|walk-in");
	}
} catch (error) {
	if (
		error instanceof TypeError &&
		error.cause instanceof Error &&
		"code" in error.cause &&
		error.cause.code === "ECONNREFUSED"
	) {
		throw new Error(`Start the app with npm run dev; nothing is listening at ${baseUrl.href}.`);
	}
	throw error;
}
