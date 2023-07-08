import { authenticate } from "@google-cloud/local-auth";
import { Role } from "@prisma/client";
import fs from "fs/promises";
import type { OAuth2Client } from "google-auth-library";
import type { ImpersonatedJWTInput, JWTInput } from "google-auth-library/build/src/auth/credentials";
import type { JSONClient } from "google-auth-library/build/src/auth/googleauth";
import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";
import type { AttachmentOptions } from "mimetext";
import { createMimeMessage } from "mimetext";
import path from "path";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { sponsorshipGmailDraftsSchema } from "../../../utils/common";

// If modifying these scopes, delete token.json
const SCOPES = ["https://mail.google.com/"];

// The file token.json stores the user's access and refresh tokens, and is created automatically when the authorization flow completes for the first time
const TOKEN_PATH = path.join(process.cwd(), "google-token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "google-credentials.json");

/**
 * Reads previously authorized credentials from the save file
 *
 * @return {Promise<JSONClient | null>}
 */
const loadSavedCredentialsIfExist = async (): Promise<JSONClient | null> => {
	try {
		const content = await fs.readFile(TOKEN_PATH, "utf8");
		const credentials = JSON.parse(content) as JWTInput | ImpersonatedJWTInput;
		return google.auth.fromJSON(credentials);
	} catch (error) {
		return null;
	}
};

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON
 *
 * @param {JSONClient} client
 * @return {Promise<void>}
 */
const saveCredentials = async (client: JSONClient): Promise<void> => {
	const content = await fs.readFile(CREDENTIALS_PATH, "utf8");
	const { installed: key } = JSON.parse(content) as CredentialsJSON;
	const payload = JSON.stringify({
		type: "authorized_user",
		client_id: key.client_id,
		client_secret: key.client_secret,
		refresh_token: client.credentials.refresh_token,
	});
	await fs.writeFile(TOKEN_PATH, payload);
};

/**
 * Load or request or authorization to call APIs
 *
 * @return {Promise<OAuth2Client>}
 */
const authorize = async (): Promise<OAuth2Client> => {
	let client: JSONClient | OAuth2Client | null = await loadSavedCredentialsIfExist();
	if (client) {
		return client as OAuth2Client;
	}
	client = await authenticate({
		scopes: SCOPES,
		keyfilePath: CREDENTIALS_PATH,
	});
	if (client.credentials) {
		await saveCredentials(client as JSONClient);
	}
	return client;
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
const createDraft = async (data: Email) => {
	const auth = await authorize();
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

/**
 * Get the email template
 *
 * @param companyName Company name
 * @param name Organizer's name
 * @returns {string} Email template
 */
const getTemplate = (companyName: string, name: string): string => `
    <p>Hello!</p>

    <p>My name is ${name}, and I am a Sponsorship Coordinator at Hack the Hill, the University of Ottawa's newest Hackathon team.</p>

	<p>We are a hackathon organized in collaboration with seven significant uOttawa student organizations: the Engineering Student Society (ESS), IEEE uOttawa Student Branch, Computer Science Student Association (CSSA), Software Engineering Student Association (SESA), Women in Engineering uOttawa Branch, uOttawa Computer Science Club, uOttawa Game Development Club and Carleton’s IEEE Student Branch.</p>

    <p>Our mission is to provide opportunities for STEM students through an annual hackathon! We have also introduced a series of monthly events throughout the year to encourage students to network and expand their technical skills in preparation for the big day!</p>

    <p>This year, we will host about 750 hackers from across North America who will receive the opportunity to innovate software and hardware solutions from March 3rd to 5th, 2023. Events like these could not happen without the support of our sponsors and we would be thrilled to partner with ${companyName}. We encourage you to take a look at our <a href="https://drive.google.com/file/d/1wD9-VEt7WQ98w8MeBwEsF1y7i6JAqQf6/view" target="_blank" rel="noreferrer">sponsorship package</a>, which is attached to this email. I am happy to answer any questions you may have!</p>

    <p>Thank you for your time and consideration!</p>

	<p>Thank you,</p>

	<p>${name}</p>
    `;

interface Email {
	subject: string;
	message: string;
	labels: string[];
	sender: string;
	recipient: string;
	attachment?: AttachmentOptions;
}

interface CredentialsJSON {
	installed: {
		client_id: string;
		project_id: string;
		auth_uri: string;
		token_uri: string;
		auth_provider_x509_cert_url: string;
		client_secret: string;
		redirect_uris: string[];
		refresh_token: string;
	};
}

export const toolsRouter = createTRPCRouter({
	sponsorshipGmailDrafts: protectedProcedure.input(sponsorshipGmailDraftsSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;
		const user = await ctx.prisma.user.findUnique({
			where: {
				id: userId,
			},
		});

		if (!user) {
			throw new Error("User not found");
		}

		if (!hasRoles(user, [Role.ORGANIZER])) {
			throw new Error("You do not have permission to do this");
		}

		const { name } = user;

		if (!name) {
			throw new Error("User does not have a name");
		}

		const { companyName, companyEmail } = input;

		return createDraft({
			subject: "Hack the Hill 2 Sponsorship",
			message: getTemplate(companyName, name),
			labels: ["UNREAD", "2023-24", name],
			sender: "sponsorship@hackthehill.com",
			recipient: companyEmail,
		});
	}),
});
