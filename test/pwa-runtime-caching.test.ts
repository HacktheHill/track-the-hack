import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { apiNetworkOnly, publicScheduleData } from "@root/pwa-runtime-caching";

void test("PWA configuration keeps participant routes deployment-safe", () => {
	const previousSelf = Object.getOwnPropertyDescriptor(globalThis, "self");
	Object.defineProperty(globalThis, "self", {
		configurable: true,
		value: { origin: "https://track.example" },
	});

	try {
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
	assert.match(config, /"\/schedule\/event"/);
	assert.match(config, /"\/assets\/maps\/floor4-current\.svg"/);
	assert.match(config, /precacheFallback: \{ fallbackURL: "\/fr\/_offline" \}/);
	assert.match(config, /precacheFallback: \{ fallbackURL: "\/_offline" \}/);

	const trpcClient = readFileSync("src/server/api/api.ts", "utf8");
	assert.match(trpcClient, /condition: operation => operation\.path === "events\.all"/);
	assert.match(trpcClient, /true: httpLink/);
	assert.match(trpcClient, /false: httpBatchLink/);

	const eventDetails = readFileSync("src/components/ScheduleEventDetails.tsx", "utf8");
	assert.match(eventDetails, /trpc\.events\.all\.useQuery/);
	assert.doesNotMatch(eventDetails, /trpc\.events\.get\.useQuery/);

	const dockerfile = readFileSync("Dockerfile", "utf8");
	assert.match(dockerfile, /COPY --from=build[^\n]*\/app\/pwa-runtime-caching\.js \.\//);
});
