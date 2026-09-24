import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	apiNetworkOnly,
	isEnglishPrivateNavigation,
	isEnglishPublicNavigation,
	isFrenchPrivateNavigation,
	isFrenchPublicNavigation,
	isPrivateNextDataRequest,
	publicPrecacheUrls,
	publicScheduleData,
} from "@root/pwa-runtime-caching";

void test("PWA configuration keeps participant routes deployment-safe", () => {
	const previousSelf = Object.getOwnPropertyDescriptor(globalThis, "self");
	Object.defineProperty(globalThis, "self", {
		configurable: true,
		value: { origin: "https://track.example" },
	});

	try {
		const navigationRequest = new Request("https://track.example/");
		Object.defineProperty(navigationRequest, "mode", { value: "navigate" });
		assert.equal(
			isEnglishPublicNavigation({
				request: navigationRequest,
				url: new URL("https://track.example/schedule/event?id=event-1"),
			}),
			true,
		);
		assert.equal(
			isFrenchPublicNavigation({ request: navigationRequest, url: new URL("https://track.example/fr/maps") }),
			true,
		);
		assert.equal(
			isEnglishPublicNavigation({
				request: navigationRequest,
				url: new URL("https://track.example/sponsors/cgi"),
			}),
			true,
		);
		assert.equal(
			isFrenchPublicNavigation({
				request: navigationRequest,
				url: new URL("https://track.example/fr/sponsors/cgi"),
			}),
			true,
		);
		assert.equal(
			isEnglishPublicNavigation({ request: navigationRequest, url: new URL("https://track.example/sponsors") }),
			false,
		);
		assert.equal(
			isEnglishPrivateNavigation({ request: navigationRequest, url: new URL("https://track.example/qr") }),
			true,
		);
		for (const path of ["/services", "/hardware", "/latte-lab", "/internal/hardware", "/internal/latte-lab"]) {
			assert.equal(
				isEnglishPrivateNavigation({
					request: navigationRequest,
					url: new URL(`https://track.example${path}`),
				}),
				true,
				`${path} must remain network-only`,
			);
		}
		assert.equal(
			isFrenchPrivateNavigation({
				request: navigationRequest,
				url: new URL("https://track.example/fr/rsvp/participant-id"),
			}),
			true,
		);
		assert.equal(
			isPrivateNextDataRequest({
				url: new URL("https://track.example/_next/data/build/fr/internal/events.json"),
			}),
			true,
		);
		assert.equal(
			isPrivateNextDataRequest({
				url: new URL("https://track.example/_next/data/build/fr/schedule.json"),
			}),
			false,
		);
		for (const matcher of [
			isEnglishPrivateNavigation,
			isEnglishPublicNavigation,
			isFrenchPrivateNavigation,
			isFrenchPublicNavigation,
			isPrivateNextDataRequest,
		]) {
			assert.doesNotMatch(
				matcher.toString(),
				/isPublicNavigation|isPrivateNavigation|privatePagePaths|withoutLocale/,
			);
		}

		const getRequest = new Request("https://track.example/api/trpc/events.all");
		assert.equal(publicScheduleData.urlPattern({ request: getRequest, url: new URL(getRequest.url) }), true);
		assert.equal(
			publicScheduleData.urlPattern({
				request: new Request(getRequest.url, { method: "POST" }),
				url: new URL(getRequest.url),
			}),
			false,
		);
		assert.equal(
			publicScheduleData.urlPattern({
				request: new Request("https://track.example/api/trpc/events.get"),
				url: new URL("https://track.example/api/trpc/events.get"),
			}),
			false,
		);
		assert.equal(apiNetworkOnly.urlPattern({ url: new URL("https://track.example/api") }), true);
		assert.equal(apiNetworkOnly.urlPattern({ url: new URL("https://track.example/api/trpc/users.search") }), true);
		assert.equal(apiNetworkOnly.urlPattern({ url: new URL("https://track.example/foo/api/trpc") }), false);
		assert.equal(apiNetworkOnly.urlPattern({ url: new URL("https://other.example/api/trpc") }), false);
	} finally {
		if (previousSelf) Object.defineProperty(globalThis, "self", previousSelf);
		else Reflect.deleteProperty(globalThis, "self");
	}

	const config = readFileSync("next.config.js", "utf8");
	assert.match(config, /publicScheduleData,\s*apiNetworkOnly,/);
	assert.match(config, /\.\.\.privateNavigationNetworkOnly,/);
	assert.match(config, /\.\.\.publicNavigationCaching,/);
	assert.match(config, /\.\.\.defaultRuntimeCaching,/);
	assert.match(config, /buildExcludes: \[\/dynamic-css-manifest\\\.json\$\/\]/);
	assert.match(config, /for \(const entry of publicPrecacheEntries\) entry\.revision = buildId/);
	assert.doesNotMatch(config, /revision: null/);
	assert.ok(publicPrecacheUrls.includes("/schedule/event"));
	assert.ok(publicPrecacheUrls.includes("/assets/maps/floor4-current.svg"));
	assert.equal(publicPrecacheUrls.includes("/sponsors"), false);
	assert.equal(publicPrecacheUrls.includes("/fr/sponsors"), false);
	assert.match(config, /precacheFallback: \{ fallbackURL: "\/fr\/_offline" \}/);
	assert.match(config, /precacheFallback: \{ fallbackURL: "\/_offline" \}/);

	const trpcClient = readFileSync("src/server/api/api.ts", "utf8");
	assert.match(trpcClient, /condition: operation => operation\.path === "events\.all"/);
	assert.match(trpcClient, /true: httpLink/);
	assert.match(trpcClient, /false: httpBatchLink/);

	const eventDetails = readFileSync("src/components/ScheduleEventDetails.tsx", "utf8");
	assert.match(eventDetails, /trpc\.events\.all\.useQuery/);
	assert.match(eventDetails, /networkMode: "offlineFirst"/);
	assert.doesNotMatch(eventDetails, /trpc\.events\.get\.useQuery/);
	const schedule = readFileSync("src/pages/schedule/index.tsx", "utf8");
	assert.match(schedule, /events\.all\.useQuery\(undefined, \{ networkMode: "offlineFirst" \}\)/);

	const dockerfile = readFileSync("Dockerfile", "utf8");
	assert.match(dockerfile, /COPY --from=build[^\n]*\/app\/pwa-runtime-caching\.js \.\//);
});
