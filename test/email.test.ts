import assert from "node:assert/strict";
import test from "node:test";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { renderApplicationEmail } from "../src/server/lib/email-content";
import { sendApplicationEmail } from "../src/server/lib/smtp-email";

test("renders localized HTML and text while escaping the applicant name", async () => {
	const english = await renderApplicationEmail({ name: '<script>alert("x")</script>', locale: "en" });
	assert.match(english.subject, /applying/i);
	assert.match(english.html, /&lt;script&gt;/);
	assert.doesNotMatch(english.html, /<script>/);
	assert.match(english.html, /hackthehill\.com\/icons\/android-chrome-512x512\.png/);
	assert.ok(english.text.trim());

	const french = await renderApplicationEmail({ name: "Zoé", locale: "fr" });
	assert.match(french.subject, /postulé/i);
	assert.match(french.html, /Salut Zoé/);
	assert.ok(french.text.includes("Zoé"));
});

test("uses the approved sender, reply-to, configuration set, HTML, and text", async () => {
	let input: Record<string, unknown> | undefined;
	const transport = {
		sendMail: async (message: Record<string, unknown>) => {
			input = message;
			return { messageId: "message-id" };
		},
	} as unknown as Pick<Transporter<SMTPTransport.SentMessageInfo>, "sendMail">;
	const result = await sendApplicationEmail(transport, {
		subject: "Subject",
		html: "<p>Hello</p>",
		text: "Hello",
	}, {
		to: "person@example.com",
		from: "info@hackthehill.com",
		fromName: "Hack the Hill",
		replyTo: "info@hackthehill.com",
		configurationSet: "my-first-configuration-set",
	});
	assert.equal(result, "message-id");
	assert.deepEqual(input?.from, { name: "Hack the Hill", address: "info@hackthehill.com" });
	assert.equal(input?.replyTo, "info@hackthehill.com");
	assert.deepEqual(input?.headers, { "X-SES-CONFIGURATION-SET": "my-first-configuration-set" });
});

test("propagates SMTP failures and rejects empty content", async () => {
	const transport = {
		sendMail: async () => { throw new Error("SMTP unavailable"); },
	} as unknown as Pick<Transporter<SMTPTransport.SentMessageInfo>, "sendMail">;
	await assert.rejects(sendApplicationEmail(transport, {
		subject: "Subject", html: "<p>Hello</p>", text: "Hello",
	}, {
		to: "person@example.com",
		from: "info@hackthehill.com",
		fromName: "Hack the Hill",
		replyTo: "info@hackthehill.com",
		configurationSet: "my-first-configuration-set",
	}), /SMTP unavailable/);
	await assert.rejects(sendApplicationEmail(transport, {
		subject: "Subject", html: "", text: "",
	}, {
		to: "person@example.com",
		from: "info@hackthehill.com",
		fromName: "Hack the Hill",
		replyTo: "info@hackthehill.com",
		configurationSet: "my-first-configuration-set",
	}), /cannot be empty/);
});
