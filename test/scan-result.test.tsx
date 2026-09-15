import assert from "node:assert/strict";
import test from "node:test";
import { EventType, TShirtSize } from "@prisma/client";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { renderToStaticMarkup } from "react-dom/server";
import ScanResult, { isArrivalCheckIn } from "../src/components/ScanResult";
import english from "../public/locales/en/qr.json";
import french from "../public/locales/fr/qr.json";

const hacker = { firstName: "Alex", lastName: "Chen", tShirtSize: TShirtSize.M, dietaryRestrictions: "Peanut allergy" };
const event = { name: "Lunch", nameFr: "Déjeuner", type: EventType.FOOD, maxCheckIns: 1 };

async function render(overrides: Partial<Parameters<typeof ScanResult>[0]> = {}, language = "en") {
	const i18n = i18next.createInstance();
	await i18n.init({ lng: language, resources: { en: { qr: english }, fr: { qr: french } } });
	return renderToStaticMarkup(
		<I18nextProvider i18n={i18n}>
			<ScanResult
				hacker={hacker}
				event={event}
				initialCount={1}
				repeated={false}
				interestedEvents={[]}
				{...overrides}
			/>
		</I18nextProvider>,
	);
}

void test("arrival scans show name and shirt size for both first and repeat visits", async () => {
	for (const repeated of [false, true]) {
		const html = await render({ event: { ...event, name: "Check-In", type: EventType.ALL }, repeated });
		assert.match(html, /Alex Chen/);
		assert.match(html, /T-shirt size/);
		assert.match(html, />M<\/dd>/);
		assert.doesNotMatch(html, /Dietary restrictions/);
	}
	assert.ok(isArrivalCheckIn("Check In"));
	assert.ok(isArrivalCheckIn("Arrival check-in"));
	assert.ok(!isArrivalCheckIn("Opening Ceremony"));
});

void test("meal status distinguishes a new redemption, a prior redemption and a zero count", async () => {
	assert.match(await render(), /Meal redeemed with this scan/);
	assert.match(await render({ repeated: true }), /Meal already redeemed/);
	const zero = await render({ repeated: true, initialCount: 0 });
	assert.match(zero, /Meal not redeemed/);
	assert.match(zero, /0 redemptions recorded/);
	assert.match(zero, /Peanut allergy/);
});

void test("food classification uses the event type and missing dietary data stays explicit", async () => {
	const html = await render({
		event: { ...event, name: "Midnight snack" },
		hacker: { ...hacker, dietaryRestrictions: "  " },
	});
	assert.match(html, /Dietary restrictions/);
	assert.match(html, /Not provided/);
});

void test("at the limit, organizers can correct the count downward but cannot increase it", async () => {
	const html = await render({ repeated: true, onIncrement: () => Promise.resolve() });
	assert.match(html, /aria-label="Increase count" disabled=""/);
	assert.doesNotMatch(html, /aria-label="Decrease count" disabled/);
});

void test("meal details and the event name are localized in French", async () => {
	const html = await render({}, "fr");
	assert.match(html, /Déjeuner/);
	assert.match(html, /Repas récupéré avec ce scan/);
	assert.match(html, /Restrictions alimentaires/);
});

void test("social and workshop scans show all interests, including events other than the scanned event", async () => {
	const interestedEvents = [
		{
			id: "workshop",
			name: "Hardware Workshop",
			nameFr: "Atelier de matériel",
			start: new Date("2026-09-27T13:00:00Z"),
		},
		{ id: "games", name: "Game Night", nameFr: "Soirée jeux", start: new Date("2026-09-27T20:00:00Z") },
	];
	for (const type of [EventType.SOCIAL, EventType.WORKSHOP]) {
		for (const repeated of [false, true]) {
			const html = await render({ event: { ...event, name: "Activity", type }, interestedEvents, repeated });
			assert.match(html, /Hardware Workshop/);
			assert.match(html, /Game Night/);
			assert.match(html, /\/schedule\/event\?id=workshop/);
		}
	}
	assert.match(await render({ event: { ...event, type: EventType.SOCIAL } }), /No events marked as interested/);
	assert.doesNotMatch(await render({ interestedEvents }), /Hardware Workshop/);
});
