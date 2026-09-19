import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory, ScannerWorkflow, TShirtSize } from "@prisma/client";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { renderToStaticMarkup } from "react-dom/server";
import ScanResult from "@/components/ScanResult";
import english from "@root/public/locales/en/qr.json";
import french from "@root/public/locales/fr/qr.json";
import common from "@root/public/locales/en/common.json";

type Props = Parameters<typeof ScanResult>[0];
const base = { eventId: "event-1", name: "Lunch", nameFr: "Déjeuner", value: 1, atLimit: true };
const participantId = "wvY1HKlwYnFBO8t-YnQbwg";
const food: Props["result"] = {
	...base,
	workflow: ScannerWorkflow.FOOD,
	participant: { id: participantId, mealCategory: MealCategory.OTHER, requiresFoodLead: true },
};
const interests = [
	{
		id: "workshop",
		name: "Hardware Workshop",
		nameFr: "Atelier de matériel",
		start: new Date("2026-09-27T13:00:00Z"),
	},
];
async function render(result: Props["result"], interestedEvents?: Props["interestedEvents"], language = "en") {
	const i18n = i18next.createInstance();
	await i18n.init({ lng: language, resources: { en: { qr: english, common }, fr: { qr: french } } });
	return renderToStaticMarkup(
		<I18nextProvider i18n={i18n}>
			<ScanResult result={result} interestedEvents={interestedEvents} />
		</I18nextProvider>,
	);
}
void test("check-in and merchandise display operational shirt data including opt-outs", async () => {
	const checkIn: Props["result"] = {
		...base,
		workflow: ScannerWorkflow.CHECK_IN,
		participant: { id: participantId, confirmed: true, tShirtSize: TShirtSize.M },
	};
	const html = await render(checkIn, interests);
	assert.match(html, /T-shirt: M/);
	assert.match(html, /Confirmed: Yes/);
	assert.doesNotMatch(html, /Hardware Workshop|Meal:/);
	const optOut = await render({
		...base,
		workflow: ScannerWorkflow.MERCHANDISE,
		participant: { id: participantId, tShirtSize: TShirtSize.NONE },
	});
	assert.match(optOut, new RegExp(common["no-t-shirt"]));
});
void test("food scans display meal category and food-lead escalation, without interests", async () => {
	const html = await render(food, interests);
	assert.match(html, /Meal: OTHER/);
	assert.match(html, /Contact the food lead/);
	assert.doesNotMatch(html, /Hardware Workshop|T-shirt:/);
	assert.match(await render(food, [], "fr"), /Déjeuner/);
});
void test("attendance scans display localized interests and distinguish loading from empty", async () => {
	const attendance: Props["result"] = {
		...base,
		workflow: ScannerWorkflow.ATTENDANCE,
		participant: { id: participantId },
	};
	assert.match(await render(attendance, interests), /Hardware Workshop/);
	assert.match(await render(attendance, interests, "fr"), /Atelier de matériel/);
	assert.match(await render(attendance, []), /No events marked as interested/);
	assert.match(await render(attendance), /Loading event interests/);
});
