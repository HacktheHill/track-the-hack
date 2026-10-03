import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { AggregateInsights } from "@/components/metrics/AggregateInsights";
import en from "@root/public/locales/en/metrics.json";
import fr from "@root/public/locales/fr/metrics.json";
import { geographicRegion, outsideCanadaBounds, pooledInsight } from "@/components/metrics/aggregate-insights";

void test("geographic classification does not infer countries from ambiguous cities or nonanswers", () => {
	for (const label of [
		"London",
		"Ottawa",
		"No",
		"N/A",
		"Toronto, CA",
		"Other / suppressed",
		"person@example.invalid",
	])
		assert.equal(geographicRegion(label, true), "unknown");
	assert.equal(geographicRegion("Toronto, Ontario, Canada", true), "canada");
	assert.equal(geographicRegion("Delhi, India", true), "outside");
	assert.equal(geographicRegion("CA"), "canada");
	assert.equal(geographicRegion("US"), "outside");
	assert.equal(geographicRegion("États-Unis"), "outside");
	assert.equal(geographicRegion("ZZ"), "unknown");
	assert.equal(geographicRegion("Unknown Region"), "unknown");
	assert.equal(geographicRegion("European Union"), "unknown");
});
void test("outside-Canada bounds never assume pooled answers are all international", () => {
	assert.deepEqual(
		outsideCanadaBounds([
			{ label: "Canada", value: 80 },
			{ label: "India", value: 8 },
			{ label: "Other / suppressed", value: 6 },
			{ label: "Not provided", value: 10 },
		]),
		{ lower: 8, upper: 14 },
	);
	assert.deepEqual(
		outsideCanadaBounds([
			{ label: "Canada", value: 80 },
			{ label: "Outside Canada", value: 20 },
		]),
		{ lower: 20, upper: 20 },
	);
	assert.deepEqual(
		outsideCanadaBounds(
			[
				{ label: "London", value: 10 },
				{ label: "Canada", value: 80 },
			],
			true,
		),
		{ lower: 0, upper: 10 },
	);
});
void test("suppressed-pool insights distinguish single-choice shares from overlapping mentions", () => {
	assert.deepEqual(pooledInsight([{ label: "Other / suppressed", value: 20 }], 100), { value: 20, share: 20 });
	assert.deepEqual(pooledInsight([{ label: "Other / suppressed", value: 20 }], 100, true), {
		value: 20,
		share: null,
	});
	assert.equal(pooledInsight([{ label: "Other / suppressed", value: 4 }], 100), null);
});

void test("bilingual insight cards preserve uncertainty and suppress small derived counts", async () => {
	for (const language of ["en", "fr"]) {
		const i18n = createInstance();
		await i18n.init({
			lng: language,
			defaultNS: "metrics",
			resources: { en: { metrics: en }, fr: { metrics: fr } },
		});
		const t = i18n.getFixedT(language, "metrics");
		const render = (rows: { label: string; value: number }[], dimension = "country") =>
			renderToStaticMarkup(createElement(AggregateInsights, { rows, total: 100, dimension, t }));
		assert.match(
			render([
				{ label: "India", value: 8 },
				{ label: "Other / suppressed", value: 6 },
			]),
			/8–14/,
		);
		assert.match(
			render(
				[
					{ label: "India", value: 8 },
					{ label: "Unclassified", value: 20 },
				],
				"travelOrigin",
			),
			language === "en" ? /At least 8/ : /Au moins 8/,
		);
		assert.match(render([{ label: "India", value: 2 }]), />2<\/p>/);
		assert.match(
			render([{ label: "India", value: 2 }], "travelOrigin"),
			language === "en" ? /Fewer than 5/ : /Moins de 5/,
		);
		assert.match(render([{ label: "Canada", value: 100 }]), />0<\/p>/);
		assert.match(
			render([{ label: "Unclassified", value: 100 }], "travelOrigin"),
			language === "en" ? /Not determinable/ : /Impossible à déterminer/,
		);
	}
});
