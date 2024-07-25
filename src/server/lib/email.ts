import type { Locale } from "@prisma/client";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import path from "path";
import { env } from "../../env/server.mjs";

await i18next.use(Backend).init({
	backend: {
		loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
	},
	preload: ["en", "fr"],
	ns: ["email"],
	defaultNS: "email",
});

type Email = {
	to: string;
	from: string;
	subject: string;
	html: string;
	text: string;
};

const sendEmail = async ({ to, from, subject, html, text }: Email) => {
	const options: SMTPTransport.Options = {
		host: env.EMAIL_SERVER_HOST,
		port: Number(env.EMAIL_SERVER_PORT),
		auth: {
			user: env.EMAIL_SERVER_USER,
			pass: env.EMAIL_SERVER_PASSWORD,
		},
	};

	const transport = createTransport(options);
	const result = await transport.sendMail({
		to,
		from,
		subject,
		text,
		html,
	});

	const failed = result.rejected.concat(result.pending).filter(Boolean);
	if (failed.length) {
		throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
	}
};

const sendApplyEmail = async ({ email, name, locale }: { email: string; name: string; locale: Locale }) => {
	await i18next.changeLanguage(locale.toLocaleLowerCase());
	const t = i18next.getFixedT(locale.toLocaleLowerCase(), "email");

	await sendEmail({
		to: email,
		from: "Hack the Hill <hello@hackthehill.com>",
		subject: t("apply.subject"),
		html: html`
			<body>
				<div style="display: none; max-height: 0px; overflow: hidden; color: transparent;">
					${t("apply.preview")}
				</div>
				<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6bc83;">
					<tr>
						<td align="center">
							<table
								width="650"
								border="0"
								cellspacing="0"
								cellpadding="0"
								style="max-width: 600px; margin: auto; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1); background-color: #84010b;"
							>
								<tr>
									<td>
										<img
											src="https://i.imgur.com/Nh1Ajh4.png"
											alt="Hack the Hill II"
											style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
										/>
									</td>
								</tr>
								<tr>
									<td style="padding: 20px; text-align: center;">
										<p style="font-size: 1rem; line-height: 1.5; color: #fff;">
											${t("apply.greeting", { name })}
										</p>
										<p style="font-size: 1rem; line-height: 1.5; color: #fff;">
											${t("apply.body")}
										</p>
										<p style="font-size: 1rem; line-height: 1.5; color: #fff;">
											${t("apply.closing")}
										</p>
										<p style="font-size: 1rem; line-height: 1.5; color: #fff3b6;">
											${t("apply.signature")}
										</p>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</body>
		`,
		text: `${t("apply.greeting", { name })}\n\n${t("apply.body")}\n\n${t("apply.closing")}\n\n${t(
			"apply.signature",
		)}`,
	});
};

const html = (strings: TemplateStringsArray, ...values: string[]) =>
	strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");

export { sendApplyEmail };
