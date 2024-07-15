import { createTransport } from "nodemailer";
import { env } from "../../env/server.mjs";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

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

const sendApplyEmail = async ({ email, name }: { email: string; name: string }) => {
	await sendEmail({
		to: email,
		from: "Hack the Hill <hello@hackthehill.com>",
		subject: "Thank you for applying to Hack the Hill II!",
		html: html`
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; color: transparent;">
    Thank you for applying for the Hack the Hill II hackathon!
  </div>
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6bc83;">
    <tr>
      <td align="center">
        <table width="650" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: auto; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1); background-color: #84010b;">
          <tr>
            <td>
				<img src="https://i.imgur.com/Nh1Ajh4.png" alt="Hack the Hill II" style="width: 100%; height: 100%; object-fit: cover; object-position: center;">
			</td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="font-size: 1rem; line-height: 1.5; color: #fff;">Hi ${name},</p>
              <p style="font-size: 1rem; line-height: 1.5; color: #fff;">Thank you for applying for the Hack the Hill II hackathon. We appreciate your interest and are excited to have you on board. Stay tuned for more updates!</p>
              <p style="font-size: 1rem; line-height: 1.5; color: #fff;">If you have any questions, feel free to reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`,
		text: `Hi ${name},\n\nThank you for applying for the Hack the Hill II hackathon. We appreciate your interest and are excited to have you on board. Stay tuned for more updates!\n\nIf you have any questions, feel free to reply to this email.`,
	});
};

const html = (strings: TemplateStringsArray, ...values: string[]) =>
	strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");

export { sendApplyEmail as sendThankYouEmail };
