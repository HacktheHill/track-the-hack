import type { OAuth2Client } from "google-auth-library";
import type { ImpersonatedJWTInput, JWTInput } from "google-auth-library/build/src/auth/credentials";
import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";
import type { AttachmentOptions } from "mimetext";
import { createMimeMessage } from "mimetext";
import { env } from "../../env/server.mjs";

/**
 * Reads authorized credentials from the environment variables
 *
 * @return {OAuth2Client} Credentials
 */
const loadCredentials = (): OAuth2Client => {
	const credentials = {
		type: "authorized_user",
		client_id: env.SPONSORSHIP_GOOGLE_CLIENT_ID,
		client_secret: env.SPONSORSHIP_GOOGLE_CLIENT_SECRET,
		refresh_token: env.SPONSORSHIP_GOOGLE_REFRESH_TOKEN,
	} as JWTInput | ImpersonatedJWTInput;
	return google.auth.fromJSON(credentials) as OAuth2Client;
};

/**
 * Get the label IDs for the given label names
 *
 * @param {gmail_v1.Gmail} gmail Gmail API instance
 * @param {string[]} labelNames
 * @return {Promise<string[]>}
 */
const getLabelIds = async (gmail: gmail_v1.Gmail, labelNames: string[]): Promise<string[]> => {
	const response = await gmail.users.labels.list({
		userId: "me",
	});
	return (
		response.data.labels?.filter(label => labelNames.includes(label.name ?? "")).map(label => label.id ?? "") ?? []
	);
};

/**
 * Generate an encoded string for the email body
 *
 * @param {Email} data Email data
 * @return {string}	Encoded email body
 */
const generateBody = (data: Email): string => {
	const msg = createMimeMessage();
	msg.setSender(data.sender);
	msg.setRecipient(data.recipient);
	msg.setSubject(data.subject);
	msg.addMessage({ contentType: "text/html", data: data.message });
	if (data.attachment) {
		msg.addAttachment(data.attachment);
	}
	return Buffer.from(msg.asRaw()).toString("base64");
};

/**
 * Create a draft email from HTML string with a PDF attachment
 *
 * @param {Email} data Email data
 */
export const createDraft = async (data: Email) => {
	const auth = loadCredentials();
	const gmail = google.gmail({ version: "v1", auth });
	const userId = "me";

	console.info("Creating draft...");
	const response = await gmail.users.drafts.create({
		userId,
		requestBody: {
			message: {
				raw: generateBody(data),
			},
		},
	});
	console.info("Draft created!");

	// Add labels to the draft's thread
	if (data.labels.length > 0 && response.data.message?.threadId) {
		console.info("Adding labels to the draft's thread...");
		await gmail.users.threads.modify({
			userId,
			id: response.data.message.threadId,
			requestBody: {
				addLabelIds: await getLabelIds(gmail, data.labels),
			},
		});
		console.info("Labels added!");
	}
};

interface Email {
	subject: string;
	message: string;
	labels: string[];
	sender: string;
	recipient: string;
	attachment?: AttachmentOptions;
}
