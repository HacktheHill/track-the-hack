import { SendEmailCommand, type SESv2Client } from "@aws-sdk/client-sesv2";
import type { ApplicationEmailContent } from "./email-content";

export async function sendApplicationEmail(
	client: Pick<SESv2Client, "send">,
	content: ApplicationEmailContent,
	config: {
		to: string;
		from: string;
		fromName: string;
		replyTo: string;
		configurationSet: string;
	},
): Promise<string> {
	if (!content.html.trim() || !content.text.trim()) throw new Error("Application email content cannot be empty");
	const result = await client.send(new SendEmailCommand({
		FromEmailAddress: `${config.fromName} <${config.from}>`,
		ReplyToAddresses: [config.replyTo],
		Destination: { ToAddresses: [config.to] },
		Content: {
			Simple: {
				Subject: { Data: content.subject, Charset: "UTF-8" },
				Body: {
					Html: { Data: content.html, Charset: "UTF-8" },
					Text: { Data: content.text, Charset: "UTF-8" },
				},
			},
		},
		ConfigurationSetName: config.configurationSet,
	}));
	if (!result.MessageId) throw new Error("SES accepted the application email without returning a message ID");
	return result.MessageId;
}
