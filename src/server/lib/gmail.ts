import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";
import type { AttachmentOptions } from "mimetext";
import { createMimeMessage } from "mimetext";

/**
 * Reads authorized credentials from the environment variables
 *
 * @return {OAuth2Client} Credentials
 */
const loadCredentials = async () => {
	const { env } = await import("@/env/server.mjs");
	const client = new google.auth.OAuth2(env.SPONSORSHIP_GOOGLE_CLIENT_ID, env.SPONSORSHIP_GOOGLE_CLIENT_SECRET);
	client.setCredentials({ refresh_token: env.SPONSORSHIP_GOOGLE_REFRESH_TOKEN });
	return client;
};

type GmailResponse<T> = Promise<{ data: T }>;

export type GmailClient = {
	users: {
		drafts: {
			create(request: {
				userId: string;
				requestBody: { message: { raw: string; threadId?: string } };
			}): GmailResponse<gmail_v1.Schema$Draft>;
		};
		labels: {
			list(request: { userId: string }): GmailResponse<gmail_v1.Schema$ListLabelsResponse>;
		};
		threads: {
			get(request: { userId: string; id: string; format: "metadata" }): GmailResponse<gmail_v1.Schema$Thread>;
			list(request: { userId: string; q: string }): GmailResponse<gmail_v1.Schema$ListThreadsResponse>;
			modify(request: {
				userId: string;
				id: string;
				requestBody: { addLabelIds: string[] };
			}): GmailResponse<gmail_v1.Schema$Thread>;
		};
	};
};

type ThreadCredentials = {
	threadId: string;
	messageId: string;
	threadSubject: string;
	sameLabel: boolean;
};

type Email = {
	subject: string;
	message: string;
	labels: string[];
	sender: string;
	recipient: string;
	attachment?: AttachmentOptions;
};

/**
 * Returns a ThreadCredentials object with a threadId, threadSubject, and messageId if a thread with the given recipient exists.
 * If a thread with the given recipient does not exist, returns undefined.
 * If multiple threads with the given recipient exist, returns the ThreadCredentials object of the most recent thread with the same labels, or the most recent thread if no threads have the same labels.
 *
 * @param {GmailClient} gmail Gmail API instance
 * @param {Email} data Email data
 * @return {Promise<ThreadCredentials | undefined>} Complete thread credentials when an eligible thread exists.
 */
const getExistingThreadCredentials = async (
	gmail: GmailClient,
	data: Email,
): Promise<ThreadCredentials | undefined> => {
	console.info("Checking for existing thread...");

	// Get the list of threads with the given recipient
	const response = await gmail.users.threads.list({
		userId: "me",
		q: `from:${data.recipient}`,
	});

	// If there are threads with the given recipient
	if (response.data.threads && response.data.threads.length > 0) {
		let latestEligibleThread: ThreadCredentials | undefined;
		const labelIds = await getLabelIds(gmail, data.labels);
		// Check each thread with the given recipient
		for (const thread of response.data.threads) {
			const threadId = thread.id;
			if (!threadId) continue;
			// Get the thread
			const responseThread = await gmail.users.threads.get({
				userId: "me",
				id: threadId,
				format: "metadata",
			});

			const messages = responseThread.data.messages;
			// Check if the thread is eligible and add it to the list of eligible threads
			if (messages && messages.length > 0) {
				const checkThreadCred = updateThreadCredentialsFromMessages(labelIds, messages);
				// Check if the thread is eligible
				if (checkThreadCred) {
					// If the thread has the same labels as the email being sent, return the threadCred object
					if (checkThreadCred.sameLabel) {
						console.info("Found existing thread with same labels!");
						return checkThreadCred;
					}
					latestEligibleThread ??= checkThreadCred;
				}
			}
		}
		if (latestEligibleThread) {
			console.info("Found existing thread with different labels!");
			return latestEligibleThread;
		}
	}
	return undefined;
};

/**
 * Read reply metadata from the newest incoming message in a thread.
 * Messages without complete reply metadata are ignored.
 * If the message has the same labels as the email being sent, sameLabel is true.
 *
 * @param {string[]} emailLabelIds List of label IDs for the email being sent
 * @param {gmail_v1.Schema$Message[]} messages List of messages in the thread
 * @return {ThreadCredentials | undefined} Complete credentials for the latest eligible message.
 */
const updateThreadCredentialsFromMessages = (
	emailLabelIds: string[],
	messages: gmail_v1.Schema$Message[],
): ThreadCredentials | undefined => {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (!message) continue;
		const headers = message.payload?.headers;
		if (headers && headers.length > 0) {
			// Drafts and sent messages are not sponsor replies.
			if (!message.labelIds?.includes("DRAFT") && !message.labelIds?.includes("SENT")) {
				// Get the Message-ID header
				const messageId = headers.find(header => header.name === "Message-ID")?.value;

				// Get the thread subject
				const threadSubject = headers.find(header => header.name === "Subject")?.value;
				const threadId = message.threadId;
				if (!messageId || !threadSubject || !threadId) continue;

				// If the message has the same labels as the email being sent, set the sameLabel property to true
				const messageLabelIds = message.labelIds ?? [];
				return {
					messageId,
					threadId,
					threadSubject,
					sameLabel: emailLabelIds.every(id => messageLabelIds.includes(id) || id === "UNREAD"),
				};
			}
		}
	}
	return undefined;
};

/**
 * Get the label IDs for the given label names
 *
 * @param {GmailClient} gmail Gmail API instance
 * @param {string[]} labelNames
 * @return {Promise<string[]>}
 */
const getLabelIds = async (gmail: GmailClient, labelNames: string[]): Promise<string[]> => {
	const response = await gmail.users.labels.list({
		userId: "me",
	});

	const labels = response.data.labels?.filter(label => {
		const labelName = label.name?.toLowerCase();
		if (!labelName) {
			return false;
		}

		// Get the first and last segment of the label name, removing any middle segments
		const segments = labelName.split("/");
		const [firstSegment, lastSegment] = [segments.at(0), segments.at(-1)];

		// For all of the given labels, check if:
		return labelNames
			.map(name => name.toLowerCase())
			.some(
				name =>
					// this existing label is exactly the same as the given label name or
					name === labelName ||
					// the last segment of this existing label contains the given label name,
					(lastSegment?.includes(name) &&
						// and the first segment of the existing label is exactly the same as any of the given label names.
						firstSegment &&
						labelNames.includes(firstSegment)),
			);
	});

	return labels?.map(label => label.id).filter((id): id is string => !!id) ?? [];
};

/**
 * Generate an encoded string for the email body
 *
 * @param {Email} data Email data
 * @return {string}	Encoded email body
 */
const generateBody = (data: Email, threadCred?: ThreadCredentials): string => {
	const msg = createMimeMessage();

	const body = data.message;
	const subject = threadCred?.threadSubject ?? data.subject;

	// Set the message headers
	msg.setSender(data.sender);
	msg.setRecipient(data.recipient);
	msg.setSubject(subject);
	if (threadCred) {
		msg.setHeader("References", threadCred.messageId);
		msg.setHeader("In-Reply-To", threadCred.messageId);
	}

	msg.addMessage({ contentType: "text/html", data: body });
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
export const createDraft = async (data: Email, gmail?: GmailClient) => {
	if (!gmail) gmail = google.gmail({ version: "v1", auth: await loadCredentials() });
	const userId = "me";

	// Check if a thread with the given recipient already exists
	const threadCred = await getExistingThreadCredentials(gmail, data);
	const raw = generateBody(data, threadCred);

	console.info("Creating draft...");
	const response = await gmail.users.drafts.create({
		userId,
		requestBody: {
			message: threadCred ? { raw, threadId: threadCred.threadId } : { raw },
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
