// @ts-check
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { i18n } = require("./next-i18next.config.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaultRuntimeCaching = require("next-pwa/cache");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiNetworkOnly, publicScheduleData } = require("./pwa-runtime-caching.js");
const publicPrecacheUrls = [
	"/",
	"/fr",
	"/schedule",
	"/fr/schedule",
	"/schedule/event",
	"/fr/schedule/event",
	"/maps",
	"/fr/maps",
	"/resources",
	"/fr/resources",
	"/sponsors",
	"/fr/sponsors",
	"/pass",
	"/fr/pass",
	"/fr/_offline",
	"/assets/maps/floor0.svg",
	"/assets/maps/floor1.svg",
	"/assets/maps/floor2.svg",
	"/assets/maps/floor3.svg",
	"/assets/maps/floor4-current.svg",
	"/assets/maps/floor5.svg",
];
const publicPrecacheEntries = publicPrecacheUrls.map(url => ({ url, revision: "development" }));

// /profile is personalized server-rendered data. These rules must stay ahead
// of next-pwa's broad JSON and same-origin rules so neither the document nor a
// client-navigation data request can ever enter a runtime cache.
/** @satisfies {import("workbox-build").RuntimeCaching[]} */
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

const publicPagePaths = new Set(["/", "/schedule", "/schedule/event", "/maps", "/resources", "/sponsors", "/pass"]);
const privatePagePaths = new Set([
	"/auth/error",
	"/auth/sign-in",
	"/cancel",
	"/claim",
	"/claim/qr",
	"/discord",
	"/internal",
	"/internal/events",
	"/internal/roles",
	"/metrics",
	"/qr",
	"/rsvp/manage",
]);

/** @param {string} pathname */
const withoutLocale = pathname => pathname.replace(/^\/fr(?=\/|$)/, "") || "/";
/** @param {{ request: Request; url: URL }} context */
const isPublicNavigation = ({ request, url }) =>
	request.mode === "navigate" && self.origin === url.origin && publicPagePaths.has(withoutLocale(url.pathname));
/** @param {{ request: Request; url: URL }} context */
const isFrenchPublicNavigation = context => isPublicNavigation(context) && context.url.pathname.startsWith("/fr");
/** @param {{ request: Request; url: URL }} context */
const isEnglishPublicNavigation = context => isPublicNavigation(context) && !context.url.pathname.startsWith("/fr");
/** @param {{ request: Request; url: URL }} context */
const isPrivateNavigation = ({ request, url }) => {
	if (request.mode !== "navigate" || self.origin !== url.origin) return false;
	const pathname = withoutLocale(url.pathname);
	return privatePagePaths.has(pathname) || pathname === "/profile" || pathname.startsWith("/rsvp/");
};
/** @param {{ request: Request; url: URL }} context */
const isFrenchPrivateNavigation = context => isPrivateNavigation(context) && context.url.pathname.startsWith("/fr");
/** @param {{ request: Request; url: URL }} context */
const isEnglishPrivateNavigation = context => isPrivateNavigation(context) && !context.url.pathname.startsWith("/fr");
/** @param {{ url: URL }} context */
const isPrivateNextDataRequest = ({ url }) => {
	if (self.origin !== url.origin || !url.pathname.startsWith("/_next/data/")) return false;
	const route = url.pathname.replace(/^\/_next\/data\/[^/]+\//, "/").replace(/\.json$/, "");
	const pathname = withoutLocale(route);
	return privatePagePaths.has(pathname) || pathname === "/profile" || pathname.startsWith("/rsvp/");
};

/** @satisfies {import("workbox-build").RuntimeCaching[]} */
const publicNavigationCaching = [
	{
		urlPattern: isFrenchPublicNavigation,
		handler: "NetworkFirst",
		options: {
			cacheName: "public-pages-fr",
			networkTimeoutSeconds: 5,
			cacheableResponse: { statuses: [200] },
			expiration: { maxEntries: 24, maxAgeSeconds: 7 * 24 * 60 * 60 },
			precacheFallback: { fallbackURL: "/fr/_offline" },
		},
	},
	{
		urlPattern: isEnglishPublicNavigation,
		handler: "NetworkFirst",
		options: {
			cacheName: "public-pages-en",
			networkTimeoutSeconds: 5,
			cacheableResponse: { statuses: [200] },
			expiration: { maxEntries: 24, maxAgeSeconds: 7 * 24 * 60 * 60 },
			precacheFallback: { fallbackURL: "/_offline" },
		},
	},
];

/** @satisfies {import("workbox-build").RuntimeCaching[]} */
const privateNavigationNetworkOnly = [
	{
		urlPattern: isPrivateNextDataRequest,
		handler: "NetworkOnly",
		options: { cacheName: "private-page-data-network-only" },
	},
	{
		urlPattern: isFrenchPrivateNavigation,
		handler: "NetworkOnly",
		options: { precacheFallback: { fallbackURL: "/fr/_offline" } },
	},
	{
		urlPattern: isEnglishPrivateNavigation,
		handler: "NetworkOnly",
		options: { precacheFallback: { fallbackURL: "/_offline" } },
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
	additionalManifestEntries: publicPrecacheEntries,
	runtimeCaching: [
		publicScheduleData,
		apiNetworkOnly,
		...participantProfileNetworkOnly,
		...privateNavigationNetworkOnly,
		...publicNavigationCaching,
		...defaultRuntimeCaching,
	],
});

module.exports = withPWA({
	reactStrictMode: true,
	i18n,
	distDir: process.env.NEXT_DIST_DIR || ".next",
	experimental: { useTypeScriptCli: false },
	turbopack: {},
	/**
	 * @template {import("webpack").Configuration & {
	 *   module: import("webpack").ModuleOptions & { rules: import("webpack").RuleSetRule[] }
	 * }} T
	 * @param {T} config
	 * @param {{ buildId: string }} context
	 * @returns {T}
	 */
	webpack: (config, { buildId }) => {
		for (const entry of publicPrecacheEntries) entry.revision = buildId;
		config.module.rules.push({
			test: /\.md$/,
			use: "raw-loader",
		});
		return config;
	},

	images: {
		remotePatterns: [{ protocol: "https", hostname: "cdn1.hackthehill.com", pathname: "/**" }],
	},
});
