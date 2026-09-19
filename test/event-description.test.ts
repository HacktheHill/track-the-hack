import assert from "node:assert/strict";
import test from "node:test";
import { getQueryKey } from "@trpc/react-query";
import type { NextRouter } from "next/router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { trpc } from "@/server/api/api";
import { event, PublicEvent, setup } from "@root/test/helpers/event-ui";

const routerFor = (locale: string): NextRouter => ({
	locale,
	basePath: "",
	pathname: "/schedule/event",
	route: "/schedule/event",
	asPath: "/schedule/event?id=event-1",
	query: { id: event.id },
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

for (const locale of ["en", "fr"]) {
	for (const { format, separator } of [
		{ format: "LF", separator: "\n" },
		{ format: "CRLF", separator: "\r\n" },
		{ format: "legacy", separator: "\\n" },
	]) {
		void test(`public ${locale} descriptions preserve ${format} line breaks and blank lines`, async t => {
			const { queryClient, wrap } = await setup(t);
			queryClient.setQueryData(getQueryKey(trpc.events.get, { id: event.id }, "query"), {
				...event,
				description: ["Welcome", "", "Next session", "End"].join(separator),
				descriptionFr: ["Bienvenue", "", "Prochaine séance", "Fin"].join(separator),
			});
			const html = renderToStaticMarkup(wrap(createElement(PublicEvent, { router: routerFor(locale) })));
			const lines =
				locale === "fr" ? ["Bienvenue", "", "Prochaine séance", "Fin"] : ["Welcome", "", "Next session", "End"];
			assert.ok(
				html.includes(
					`<p class="text-xl">${lines.map((line, index) => `<span>${line}${index < lines.length - 1 ? "<br/>" : ""}</span>`).join("")}</p>`,
				),
			);
		});
	}
}
