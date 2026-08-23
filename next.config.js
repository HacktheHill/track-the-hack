// @ts-check
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { i18n } = require("./next-i18next.config.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaultRuntimeCaching = require("next-pwa/cache");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const apiNetworkOnly = require("./pwa-runtime-caching.js");
const passPrecacheEntries = ["/pass", "/fr/pass"].map(url => ({ url, revision: "development" }));

// /profile is personalized server-rendered data. These rules must stay ahead
// of next-pwa's broad JSON and same-origin rules so neither the document nor a
// client-navigation data request can ever enter a runtime cache.
const participantProfileNetworkOnly = [
	{
		urlPattern: /\/_next\/data\/[^/]+\/(?:en\/|fr\/)?profile\.json(?:[?#]|$)/i,
		handler: "NetworkOnly",
		options: { cacheName: "participant-profile-data-network-only" },
	},
	{
		urlPattern: /\/fr\/profile(?:\/?(?:[?#]|$))/i,
		handler: "NetworkOnly",
		options: { precacheFallback: { fallbackURL: "/fr/pass" } },
	},
	{
		urlPattern: /\/(?:en\/)?profile(?:\/?(?:[?#]|$))/i,
		handler: "NetworkOnly",
		options: { precacheFallback: { fallbackURL: "/pass" } },
	},
];

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
!process.env.SKIP_ENV_VALIDATION && import("./src/env/server.mjs");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withPWA = require("next-pwa")({
	dest: "public",
	register: true,
	disable: process.env.NODE_ENV === "development",
	// Next 16 emits this file into .next but does not serve it from /_next.
	// Precaching it makes the whole service-worker installation fail on a 404.
	buildExcludes: [/dynamic-css-manifest\.json$/],
	additionalManifestEntries: passPrecacheEntries,
	runtimeCaching: [apiNetworkOnly, ...participantProfileNetworkOnly, ...defaultRuntimeCaching],
});

module.exports = withPWA({
	reactStrictMode: true,
	i18n,
	distDir: process.env.NEXT_DIST_DIR || ".next",
	experimental: { useTypeScriptCli: false },
	webpack: (config, { buildId }) => {
		for (const entry of passPrecacheEntries) entry.revision = buildId;
		config.module.rules.push({
			test: /\.md$/,
			use: "raw-loader",
		});
		return config;
	},

	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "cdn1.hackthehill.com", pathname: "/**" },
			{ protocol: "https", hostname: "2024.hackthehill.com", pathname: "/Logos/**" },
		],
	},
});
