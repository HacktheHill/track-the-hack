import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { ApplicationEmailContent } from "./email-content";

type MailTransport = Pick<Transporter<SMTPTransport.SentMessageInfo>, "sendMail">;

export async function sendApplicationEmail(
	transport: MailTransport,
	content: ApplicationEmailContent,
	config: {
		to: string;
		from: string;
		fromName: string;
		replyTo: string;
		configurationSet?: string;
	},
): Promise<string> {
	if (!content.html.trim() || !content.text.trim()) throw new Error("Application email content cannot be empty");

	const result = await transport.sendMail({
		from: { name: config.fromName, address: config.from },
		to: config.to,
		replyTo: config.replyTo,
		subject: content.subject,
		html: content.html,
		text: content.text,
		headers: config.configurationSet
			? { "X-SES-CONFIGURATION-SET": config.configurationSet }
			: undefined,
	});

	if (!result.messageId) throw new Error("SMTP accepted the application email without returning a message ID");
	return result.messageId;
}
