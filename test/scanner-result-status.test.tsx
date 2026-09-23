import assert from "node:assert/strict";
import test from "node:test";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { renderToStaticMarkup } from "react-dom/server";
import ScannerResultStatus from "@/components/ScannerResultStatus";
import english from "@root/public/locales/en/qr.json";
import french from "@root/public/locales/fr/qr.json";

const render = async (recordedNow: boolean, language: "en" | "fr") => {
	const i18n = createInstance();
	await i18n.init({ lng: language, resources: { en: { qr: english }, fr: { qr: french } } });
	return renderToStaticMarkup(
		<I18nextProvider i18n={i18n}>
			<ScannerResultStatus recordedNow={recordedNow} />
		</I18nextProvider>,
	);
};

void test("scanner status distinguishes new and duplicate records in both locales", async () => {
	assert.match(await render(true, "en"), /Entry recorded/);
	assert.match(await render(false, "en"), /Already recorded/);
	assert.match(await render(true, "fr"), /Entrée enregistrée/);
	assert.match(await render(false, "fr"), /Déjà enregistré/);
});

void test("stale adjustment feedback shows the authoritative count in both locales", async () => {
	for (const [language, expected] of [
		["en", "Current count: 4"],
		["fr", "Nombre actuel : 4"],
	] as const) {
		const i18n = createInstance();
		await i18n.init({ lng: language, resources: { en: { qr: english }, fr: { qr: french } } });
		assert.match(i18n.t("qr:adjust-stale", { value: 4 }), new RegExp(expected));
	}
});
