import { createInstance } from "i18next";
import Backend from "i18next-fs-backend";
import path from "node:path";

export type ApplicationEmailContent = {
	subject: string;
	html: string;
	text: string;
};

const i18n = createInstance();
const ready = i18n.use(Backend).init({
	backend: { loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json") },
	preload: ["en", "fr"],
	ns: ["email"],
	defaultNS: "email",
	interpolation: { escapeValue: false },
});

export async function renderApplicationEmail(input: {
	name: string;
	locale: "en" | "fr";
}): Promise<ApplicationEmailContent> {
	await ready;
	const t = i18n.getFixedT(input.locale, "email");
	const greeting = t("apply.greeting", { name: input.name });
	const body = t("apply.body");
	const closing = t("apply.closing");
	const signature = t("apply.signature");
	const preview = t("apply.preview");
	const html = `<!doctype html><html lang="${input.locale}"><body style="margin:0;background:#f6bc83;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6bc83;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#650014;border-radius:16px;overflow:hidden"><tr><td align="center" style="padding:24px"><img src="https://hackthehill.com/icons/android-chrome-512x512.png" alt="Hack the Hill" width="128" height="128" style="display:block;width:128px;height:128px"></td></tr><tr><td style="padding:0 28px 28px;text-align:center;color:#fff"><p style="font-size:16px;line-height:1.5">${escapeHtml(greeting)}</p><p style="font-size:16px;line-height:1.5">${escapeHtml(body)}</p><p style="font-size:16px;line-height:1.5">${escapeHtml(closing)}</p><p style="font-size:16px;line-height:1.5;color:#f6bc83">${escapeHtml(signature)}</p></td></tr></table></td></tr></table></body></html>`;
	return {
		subject: t("apply.subject"),
		html,
		text: `${greeting}\n\n${body}\n\n${closing}\n\n${signature}`,
	};
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
