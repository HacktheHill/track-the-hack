import assert from "node:assert/strict";
import test from "node:test";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { renderToStaticMarkup } from "react-dom/server";
import ScannerResultStatus from "@/components/ScannerResultStatus";
import type { ScanOutcome } from "@/server/services/scanner-workflows";
import english from "@root/public/locales/en/qr.json";
import french from "@root/public/locales/fr/qr.json";

const render = async (outcome: ScanOutcome, language: "en" | "fr") => {
	const i18n = createInstance();
	await i18n.init({ lng: language, resources: { en: { qr: english }, fr: { qr: french } } });
	return renderToStaticMarkup(
		<I18nextProvider i18n={i18n}>
			<ScannerResultStatus outcome={outcome} />
		</I18nextProvider>,
	);
};

void test("scanner status distinguishes every scan outcome in both locales", async () => {
	assert.match(await render("new", "en"), /Entry recorded/);
	assert.match(await render("incremented", "en"), /Count increased/);
	assert.match(await render("unchanged", "en"), /Already recorded/);
	assert.match(await render("limit", "en"), /Limit reached/);
	assert.match(await render("new", "fr"), /Entrée enregistrée/);
	assert.match(await render("incremented", "fr"), /Nombre augmenté/);
	assert.match(await render("unchanged", "fr"), /Déjà enregistré/);
	assert.match(await render("limit", "fr"), /Limite atteinte/);
});

void test("stale adjustment feedback shows the authoritative count in both locales", async () => {
	for (const [language, expected] of [
		["en", "Current count: 4"],
		["fr", "Nombre actuel: 4"],
	] as const) {
		const i18n = createInstance();
		await i18n.init({ lng: language, resources: { en: { qr: english }, fr: { qr: french } } });
		assert.match(i18n.t("qr:adjust-stale", { value: 4 }), new RegExp(expected));
	}
});
