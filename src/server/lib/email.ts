import type { Locale } from "@prisma/client";
import nodemailer from "nodemailer";
import { env } from "../../env/server.mjs";
import { renderApplicationEmail } from "./email-content";
import { sendApplicationEmail } from "./smtp-email";

const mailer = nodemailer.createTransport({
	host: env.EMAIL_SERVER_HOST,
	port: env.EMAIL_SERVER_PORT,
	secure: env.EMAIL_SERVER_PORT === 465,
	auth: {
		user: env.EMAIL_SERVER_USER,
		pass: env.EMAIL_SERVER_PASSWORD,
	},
	connectionTimeout: 10_000,
	socketTimeout: 15_000,
});

export async function sendApplyEmail({
	email,
	name,
	locale,
}: {
	email: string;
	name: string;
	locale: Locale;
}): Promise<void> {
	const message = await renderApplicationEmail({ name, locale: locale.toLowerCase() === "fr" ? "fr" : "en" });
	await sendApplicationEmail(mailer, message, {
		to: email,
		from: env.EMAIL_FROM,
		fromName: "Hack the Hill",
		replyTo: env.EMAIL_FROM,
		configurationSet: env.SES_CONFIGURATION_SET,
	});
}
