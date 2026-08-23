import {
	acceptedSheetRowsToOperationalRecords,
	loadTallySheetFixture,
	syncTallyFixtureToSheet,
} from "./dev-tally-sheet.mjs";
import { deliverLocalParticipantEmail } from "./dev-email.mjs";

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

const post = async (path, body) => {
	const response = await fetch(new URL(path, baseUrl), {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	const result = await response.json();
	if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(result)}`);
	return result;
};

try {
	switch (command) {
		case "rsvp": {
			await post("/api/integrations/sheets/hackers", { hackers: [participants.normal] });
			const email = await deliverLocalParticipantEmail({
				type: "invitation",
				link: new URL(`/rsvp/${participants.normal.id}`, baseUrl).href,
			});
			console.info(`Invitation email delivered through local SMTP: ${email.file}`);
			console.info(`RSVP link: ${email.links[0]}`);
			break;
		}
		case "reconcile": {
			const result = await post("/api/integrations/sheets/rsvp-reconciliation", {
				ids: [participants.normal.id],
			});
			const participant = result.records[0];
			console.info(`RSVP status: ${participant?.confirmed ? "confirmed" : "not confirmed"}`);
			if (participant?.cancellationLink) {
				const email = await deliverLocalParticipantEmail({
					type: "confirmation",
					link: participant.cancellationLink,
				});
				console.info(`Confirmation email delivered through local SMTP: ${email.file}`);
				console.info(`Cancellation link: ${email.links[0]}`);
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
			const result = await post("/api/integrations/sheets/claim", participant);
			console.info(`Simulated Sheet claim link: ${result.claimUrl}`);
			console.info(`Scanner input: ${participant.id}`);
			break;
		}
		default:
			throw new Error("Usage: npm run dev:participant -- rsvp|reconcile|claim|walk-in");
	}
} catch (error) {
	if (error instanceof TypeError && error.cause?.code === "ECONNREFUSED") {
		throw new Error(`Start the app with npm run dev; nothing is listening at ${baseUrl}.`);
	}
	throw error;
}
