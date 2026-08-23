import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import apiNetworkOnly from "@root/pwa-runtime-caching";

void test("PWA configuration keeps participant routes deployment-safe", () => {
	const previousSelf = Object.getOwnPropertyDescriptor(globalThis, "self");
	Object.defineProperty(globalThis, "self", {
		configurable: true,
		value: { origin: "https://track.example" },
	});

	try {
		assert.equal(apiNetworkOnly.urlPattern({ url: new URL("https://track.example/api") }), true);
		assert.equal(apiNetworkOnly.urlPattern({ url: new URL("https://track.example/api/trpc/users.search") }), true);
		assert.equal(apiNetworkOnly.urlPattern({ url: new URL("https://track.example/foo/api/trpc") }), false);
		assert.equal(apiNetworkOnly.urlPattern({ url: new URL("https://other.example/api/trpc") }), false);
	} finally {
		if (previousSelf) Object.defineProperty(globalThis, "self", previousSelf);
		else Reflect.deleteProperty(globalThis, "self");
	}

	const config = readFileSync("next.config.js", "utf8");
	assert.match(config, /runtimeCaching: \[apiNetworkOnly,[^\]]*\.\.\.defaultRuntimeCaching\]/);
	assert.match(config, /for \(const entry of passPrecacheEntries\) entry\.revision = buildId/);
	assert.doesNotMatch(config, /revision: null/);

	const dockerfile = readFileSync("Dockerfile", "utf8");
	assert.match(dockerfile, /COPY --from=build[^\n]*\/app\/pwa-runtime-caching\.js \.\//);
});
