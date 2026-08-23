import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMimeMessage } from "mimetext";
import nodemailer from "nodemailer";
import { SMTPServer } from "smtp-server";

const templates = {
	invitation: {
		subject: "Track the Hack RSVP invitation",
		text: link => `Your RSVP is ready. Review and confirm it here:\n\n${link}`,
		html: link => `<p>Your RSVP is ready.</p><p><a href="${link}">Review and confirm your RSVP</a></p>`,
	},
	confirmation: {
		subject: "Track the Hack RSVP confirmed",
		text: link => `Your RSVP is confirmed. If your plans change, cancel it here:\n\n${link}`,
		html: link => `<p>Your RSVP is confirmed.</p><p><a href="${link}">Cancel your RSVP</a></p>`,
	},
};

const startSmtpSink = async () => {
	let resolveMessage;
	let rejectMessage;
	const message = new Promise((resolveMessagePromise, rejectMessagePromise) => {
		resolveMessage = resolveMessagePromise;
		rejectMessage = rejectMessagePromise;
	});

	const server = new SMTPServer({
		authOptional: true,
		disabledCommands: ["AUTH", "STARTTLS"],
		logger: false,
		size: 256 * 1024,
		onData(stream, session, callback) {
			const chunks = [];
			stream.on("data", chunk => chunks.push(Buffer.from(chunk)));
			stream.once("error", error => {
				rejectMessage(error);
				callback(error);
			});
			stream.once("end", () => {
				if (stream.sizeExceeded) {
					const error = new Error("Local development email exceeded 256 KiB");
					error.responseCode = 552;
					rejectMessage(error);
					callback(error);
					return;
				}
				resolveMessage({
					raw: Buffer.concat(chunks),
					from: session.envelope.mailFrom?.address ?? "",
					to: session.envelope.rcptTo.map(recipient => recipient.address),
				});
				callback(null, "Captured by the Track the Hack development SMTP sink");
			});
		},
	});
	server.on("error", rejectMessage);

	await new Promise((resolveListen, rejectListen) => {
		const onError = error => rejectListen(error);
		server.server.once("error", onError);
		server.listen(0, "127.0.0.1", () => {
			server.server.off("error", onError);
			resolveListen();
		});
	});

	const address = server.server.address();
	if (!address || typeof address === "string") throw new Error("Could not start the local SMTP sink");

	return {
		message,
		port: address.port,
		close: () => new Promise(resolveClose => server.close(resolveClose)),
	};
};

const parseCapturedMessage = message => {
	const raw = message.toString("utf8");
	const headers = raw.slice(0, raw.search(/\r?\n\r?\n/));
	const header = name => {
		const value = headers.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
		return value.replace(/=\?utf-8\?B\?([^?]+)\?=/gi, (_match, encoded) =>
			Buffer.from(encoded, "base64").toString("utf8"),
		);
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
 * @param {{ type: keyof typeof templates, link: string, mailboxDirectory?: string }} input
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
