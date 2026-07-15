import type { Locale } from "@prisma/client";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { env } from "../../env/server.mjs";
import { renderApplicationEmail } from "./email-content";
import { sendApplicationEmail } from "./ses-email";

const ses = new SESv2Client({
	region: env.AWS_REGION,
	maxAttempts: 2,
	requestHandler: new NodeHttpHandler({ connectionTimeout: 10_000, requestTimeout: 15_000 }),
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
	await sendApplicationEmail(ses, message, {
		to: email,
		from: "info@hackthehill.com",
		fromName: "Hack the Hill",
		replyTo: "info@hackthehill.com",
		configurationSet: env.SES_CONFIGURATION_SET,
	});
}
