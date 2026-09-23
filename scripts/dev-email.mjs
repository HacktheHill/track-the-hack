import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMimeMessage } from "mimetext";
import nodemailer from "nodemailer";
import { SMTPServer } from "smtp-server";

/** @typedef {"invitation"} ParticipantEmailType */
/** @typedef {{raw: Buffer, from: string, to: string[]}} CapturedMessage */

/** @type {Record<ParticipantEmailType, {subject: string, text: (link: string) => string, html: (link: string) => string}>} */
const templates = {
	invitation: {
		subject: "RSVP for Hack the Hill III",
		text: link => `Let us know if you can attend. Use the same link later to change your answer:\n\n${link}`,
		html: link => `<p>Let us know if you can attend.</p><p><a href="${link}">Manage your RSVP</a></p><p>Use the same link later to change your answer.</p>`,
	},
};

const startSmtpSink = async () => {
	/** @type {PromiseWithResolvers<CapturedMessage>} */
	const messageState = Promise.withResolvers();
	const { promise: message, resolve: resolveMessage, reject: rejectMessage } = messageState;

	const server = new SMTPServer({
		authOptional: true,
		disabledCommands: ["AUTH", "STARTTLS"],
		logger: false,
		size: 256 * 1024,
		onData(stream, session, callback) {
			/** @type {Buffer[]} */
			const chunks = [];
			/** @param {Uint8Array} chunk */
			const collectChunk = chunk => chunks.push(Buffer.from(chunk));
			stream.on("data", collectChunk);
			stream.once("error", error => {
				rejectMessage(error);
				callback(error);
			});
			stream.once("end", () => {
				if (stream.sizeExceeded) {
					const error = Object.assign(new Error("Local development email exceeded 256 KiB"), {
						responseCode: 552,
					});
					rejectMessage(error);
					callback(error);
					return;
				}
				resolveMessage({
					raw: Buffer.concat(chunks),
					from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
					to: session.envelope.rcptTo.map(recipient => recipient.address),
				});
				callback(null, "Captured by the Track the Hack development SMTP sink");
			});
		},
	});
	server.on("error", rejectMessage);

	/** @type {Promise<void>} */
	const listening = new Promise((resolveListen, rejectListen) => {
		/** @param {Error} error */
		const onError = error => rejectListen(error);
		server.server.once("error", onError);
		server.listen(0, "127.0.0.1", () => {
			server.server.off("error", onError);
			resolveListen();
		});
	});
	await listening;

	const address = server.server.address();
	if (!address || typeof address === "string") throw new Error("Could not start the local SMTP sink");

	const close = () => {
		/** @type {Promise<void>} */
		const closed = new Promise(resolveClose => server.close(resolveClose));
		return closed;
	};

	return {
		message,
		port: address.port,
		close,
	};
};

/** @param {Buffer} message */
const parseCapturedMessage = message => {
	const raw = message.toString("utf8");
	const headers = raw.slice(0, raw.search(/\r?\n\r?\n/));
	/** @param {string} name */
	const header = name => {
		const value = headers.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
		/**
		 * @param {string} _match
		 * @param {string} encoded
		 */
		const decodeHeader = (_match, encoded) => Buffer.from(encoded, "base64").toString("utf8");
		return value.replace(/=\?utf-8\?B\?([^?]+)\?=/gi, decodeHeader);
	};
	const text = raw.match(/Content-Type: text\/plain[^\r\n]*\r?\n[\s\S]*?\r?\n\r?\n([\s\S]*?)\r?\n--/)?.[1];
	if (text === undefined) throw new Error("The captured development email has no text/plain MIME part");

	return {
		subject: header("Subject"),
		text,
		type: header("X-Track-The-Hack-Dev-Email"),
		links: [...new Set([...text.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(match => match[0]))],
	};
};

/**
 * Sends one real SMTP message to an ephemeral loopback capture server and
 * stores the captured RFC message in a local mailbox directory.
 *
 * @param {{ type: ParticipantEmailType, link: string, mailboxDirectory?: string }} input
 */
export const deliverLocalParticipantEmail = async ({
	type,
	link,
	mailboxDirectory = resolve(process.cwd(), ".dev-mailbox"),
}) => {
	const template = templates[type];
	if (!template) throw new Error(`Unknown development email type: ${type}`);
	const url = new URL(link);
	if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Development email links must use HTTP(S)");

	const sink = await startSmtpSink();
	const message = createMimeMessage();
	message.setSender({ name: "Track the Hack Dev", addr: "no-reply@track.local" });
	message.setRecipient("participant@example.test");
	message.setSubject(template.subject);
	message.setHeader("X-Track-The-Hack-Dev-Email", type);
	message.addMessage({ contentType: "text/plain", data: template.text(url.href) });
	message.addMessage({ contentType: "text/html", data: template.html(url.href) });

	const transport = nodemailer.createTransport({
		host: "127.0.0.1",
		port: sink.port,
		secure: false,
		ignoreTLS: true,
		connectionTimeout: 5_000,
		greetingTimeout: 5_000,
		socketTimeout: 5_000,
	});

	let captured;
	try {
		const [, capturedMessage] = await Promise.all([
			transport.sendMail({
				envelope: { from: "no-reply@track.local", to: "participant@example.test" },
				raw: message.asRaw(),
			}),
			sink.message,
		]);
		captured = capturedMessage;
	} finally {
		transport.close();
		await sink.close();
	}

	await mkdir(mailboxDirectory, { recursive: true, mode: 0o700 });
	const file = resolve(mailboxDirectory, `${Date.now()}-${type}-${randomUUID()}.eml`);
	await writeFile(file, captured.raw, { flag: "wx", mode: 0o600 });
	const parsed = parseCapturedMessage(captured.raw);

	return {
		file,
		from: captured.from,
		to: captured.to,
		...parsed,
	};
};
