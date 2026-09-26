import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { Navbar } from "@/components/Navigation";
import navbarEn from "@root/public/locales/en/navbar.json";

const router: NextRouter = {
	locale: "en",
	defaultLocale: "en",
	locales: ["en", "fr"],
	basePath: "",
	pathname: "/",
	route: "/",
	asPath: "/",
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
};

const session = (isOrganizer: boolean): Session => ({
	expires: "2099-01-01T00:00:00.000Z",
	user: {
		id: "user-1",
		isOrganizer,
		isAdmin: false,
		name: "Test User",
		email: "test@example.test",
	},
});

async function render(sessionData: Session | null) {
	const i18n = i18next.createInstance();
	await i18n.init({ lng: "en", resources: { en: { navbar: navbarEn } } });
	return renderToStaticMarkup(
		<RouterContext.Provider value={router}>
			<SessionProvider session={sessionData}>
				<I18nextProvider i18n={i18n}>
					<Navbar />
				</I18nextProvider>
			</SessionProvider>
		</RouterContext.Provider>,
	);
}

void test("organisers can open the internal tools page from navigation", async () => {
	const html = await render(session(true));
	assert.match(html, /href="\/internal"/);
	assert.match(html, /aria-label="Organiser tools"/);
});

void test("the internal tools navigation item is hidden from non-organisers", async () => {
	assert.doesNotMatch(await render(session(false)), /href="\/internal"/);
	assert.doesNotMatch(await render(null), /href="\/internal"/);
});
