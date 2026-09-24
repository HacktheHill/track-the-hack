import assert from "node:assert/strict";
import test from "node:test";
import { MealCategory, TShirtSize } from "@prisma/client";
import i18next from "i18next";
import { SessionProvider } from "next-auth/react";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import { I18nextProvider } from "react-i18next";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProfileData } from "@/pages/profile";
import commonEn from "@root/public/locales/en/common.json";
import navbarEn from "@root/public/locales/en/navbar.json";
import profileEn from "@root/public/locales/en/profile.json";
import commonFr from "@root/public/locales/fr/common.json";
import navbarFr from "@root/public/locales/fr/navbar.json";
import profileFr from "@root/public/locales/fr/profile.json";

const routerFor = (locale: string): NextRouter => ({
	locale,
	defaultLocale: "en",
	locales: ["en", "fr"],
	basePath: "",
	pathname: "/profile",
	route: "/profile",
	asPath: "/profile",
	query: {},
	isReady: true,
	isFallback: false,
	isPreview: false,
	isLocaleDomain: false,
	push: () => Promise.resolve(true),
	replace: () => Promise.resolve(true),
	reload: () => undefined,
	back: () => undefined,
	forward: () => undefined,
	prefetch: () => Promise.resolve(),
	beforePopState: () => undefined,
	events: { on: () => undefined, off: () => undefined, emit: () => undefined },
});

const profile: ProfileData = {
	id: "wvY1HKlwYnFBO8t-YnQbwg",
	confirmed: true,
	tShirtSize: TShirtSize.M,
	mealCategory: MealCategory.VEGAN,
	presences: [{ id: "presence-1", label: "", value: 1 }],
};

async function render(language: "en" | "fr", eventLabel: string) {
	Object.assign(process.env, {
		DATABASE_URL: "mysql://root:password@localhost:3306/track_the_hack",
		NODE_ENV: "test",
		NEXTAUTH_URL: "http://localhost:3000",
		GOOGLE_CLIENT_ID: "",
		GOOGLE_CLIENT_SECRET: "",
		EMAIL_SERVER_HOST: "localhost",
		EMAIL_SERVER_PORT: "1025",
		EMAIL_SERVER_USER: "test",
		EMAIL_SERVER_PASSWORD: "test",
		EMAIL_FROM: "noreply@example.test",
		SHEETS_INTEGRATION_API_KEY: "s".repeat(32),
		CANCELLATION_TOKEN_SECRET: "c".repeat(32),
		CLAIM_TOKEN_SECRET: "l".repeat(32),
		PARTICIPANT_SESSION_SECRET: "p".repeat(32),
	});
	const { default: Profile } = await import("@/pages/profile");
	const i18n = i18next.createInstance();
	await i18n.init({
		lng: language,
		resources: {
			en: { profile: profileEn, navbar: navbarEn, common: commonEn },
			fr: { profile: profileFr, navbar: navbarFr, common: commonFr },
		},
	});
	return renderToStaticMarkup(
		<RouterContext.Provider value={routerFor(language)}>
			<SessionProvider session={null}>
				<I18nextProvider i18n={i18n}>
					<Profile
						profile={{
							...profile,
							presences: [{ id: "presence-1", label: eventLabel, value: 1 }],
						}}
					/>
				</I18nextProvider>
			</SessionProvider>
		</RouterContext.Provider>,
	);
}

void test("profile renders English meal and current event labels", async () => {
	const html = await render("en", "Updated opening ceremony");
	assert.match(html, /Meal category<\/dt><dd>Vegan/);
	assert.match(html, /Updated opening ceremony/);
});

void test("profile renders French meal and current event labels", async () => {
	const html = await render("fr", "Cérémonie d’ouverture à jour");
	assert.match(html, /Catégorie de repas<\/dt><dd>Végétalien/);
	assert.match(html, /Cérémonie d’ouverture à jour/);
});
