import type { OAuth2Client } from "google-auth-library";
import type { ImpersonatedJWTInput, JWTInput } from "google-auth-library/build/src/auth/credentials";
import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";
import { maxHeaderSize } from "http";
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
 * Returns a threadCredentials object with a threadId, threadSubject, and messageId if a thread with the given recipient exists.
 *
 * @param {gmail_v1.Gmail} gmail Gmail API instance
 * @param {Email} data Email data
 * @return {Promise<string[]>} Whether or not a thread with the given recipient exists
 */
 const getExistingThreadCredentials = async (gmail: gmail_v1.Gmail, data: Email): Promise<threadCredentials> => {
	// Create an initial threadCredentials object
	const threadCred: threadCredentials = {
		threadId: '',
		messageId: '',
		threadSubject: '',
	};

	// Get the list of threads with the given recipient
    const response = await gmail.users.threads.list({
        userId: "me",
        q: `to:${data.recipient}`,
    });

	// If there are threads with the given recipient
    if (response.data.threads && response.data.threads.length > 0) {
        // Check each thread with the given recipient
		for (const thread of response.data.threads) {
			const threadId = thread.id as string;
			// Get the thread
			const responseThread = await gmail.users.threads.get({
				userId: 'me',
				id: threadId,
				format: 'metadata',
			});

			const messages = responseThread.data.messages;
			if (messages && messages.length > 0) {
				return updateThreadCredentialsFromMessages(gmail,threadCred,messages); // Pass threadId and messages to processMessages
			}
		}
    }

	return threadCred;
}

/**
 * Update thread credentials based on the headers of messages within a thread.
 *
 * @param {threadCredentials} threadCred Thread credentials object to be updated
 * @param {gmail_v1.Schema$Message[]} messages List of messages in the thread
 * @return {threadCredentials} Updated thread credentials object with the latest threadId, threadSubject, and messageId
 */
 const updateThreadCredentialsFromMessages = (gmail: gmail_v1.Gmail,threadCred: threadCredentials, messages: gmail_v1.Schema$Message[]): threadCredentials => {
	// Reverse the order of the messages so that the most recent message is first
	messages.reverse();
	// For each message in the thread
    for (const message of messages) {
        const headers = message.payload?.headers;
        if (headers && headers.length > 0) {
			let string = "";
			for (const header of headers) {
				if (header.name && header.value){
					string += `${header.name}: ${header.value}\n`;
				}
			}

			// Get the Message-ID header
			const headerMessageId = headers.find(header => header.name === 'Message-ID');
			const messageId = headerMessageId?.value ?? '';

			threadCred.messageId = messageId;

            // Get the thread subject
            const headerSubject = headers.find(header => header.name === 'Subject');
            threadCred.threadSubject = headerSubject?.value ?? '';

            // Set the threadId in the threadCred object
            threadCred.threadId = message.threadId ?? '';
			
			return threadCred;
        }
    }
    return threadCred;
}


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
const generateBody = (data: Email, threadCred: threadCredentials): string => {
	const msg = createMimeMessage();

	  // Create the In-Reply-To and References headers
	//   const inReplyToHeader = `In-Reply-To: <${"<CACx9fuy0jph52=fVPK2AZujgxmUN96GK-uXFrXiegQkA+ivYWw@mail.gmail.com>"}>\n`
	//   const referencesHeader = `References: <${"<CACx9fuy0jph52=fVPK2AZujgxmUN96GK-uXFrXiegQkA+ivYWw@mail.gmail.com>"}>\n`

	// if threadId is not empty, add it to the body
	//const body = threadCred.threadId ? 'In-Reply-To:' +  threadCred.threadId + '\n\n Subject: ' + threadCred.threadSubject  + '\n\n' + data.message : data.message;
	const body = data.message;
	const subject = threadCred.threadSubject ? threadCred.threadSubject : data.subject;
	msg.setSender(data.sender);
	msg.setRecipient(data.recipient);
	msg.setSubject(subject);
	// msg.setHeader("References", "<CACx9fuy0jph52=fVPK2AZujgxmUN96GK-uXFrXiegQkA+ivYWw@mail.gmail.com>");
	// msg.setHeader("In-Reply-To", "<CACx9fuy0jph52=fVPK2AZujgxmUN96GK-uXFrXiegQkA+ivYWw@mail.gmail.com>");
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
export const createDraft = async (data: Email) => {
	const auth = loadCredentials();
	const gmail = google.gmail({ version: "v1", auth });
	const userId = "me";

	// Check if a thread with the given recipient already exists
	const threadCred = await getExistingThreadCredentials(gmail, data);

	console.info("Creating draft...");
	const response = await gmail.users.drafts.create({
		userId,
		requestBody: {
			message: {
				raw: generateBody(data, threadCred),
				threadId: threadCred.threadId,

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

// Interface for the thread credentials
interface threadCredentials {
	threadId: string;
	messageId: string;
	threadSubject: string;
}

// Interface for the email data
interface Email {
	subject: string;
	message: string;
	labels: string[];
	sender: string;
	recipient: string;
	attachment?: AttachmentOptions;
}
