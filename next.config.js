// @ts-check
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { i18n } = require("./next-i18next.config.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaultRuntimeCaching = require("next-pwa/cache");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pwaRuntimeCaching = require("./pwa-runtime-caching.js");
const {
	apiNetworkOnly,
	publicScheduleData,
	isEnglishPrivateNavigation,
	isEnglishPublicNavigation,
	isFrenchPrivateNavigation,
	isFrenchPublicNavigation,
	isPrivateNextDataRequest,
	publicPrecacheUrls,
} = pwaRuntimeCaching;
const publicPrecacheEntries = publicPrecacheUrls.map(url => ({ url, revision: "development" }));

// Pages Router requires inline bootstrap scripts and the existing UI uses inline
// styles. Keep the policy explicit so every other resource type remains closed.
const developmentScriptSources = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const developmentConnectSources = process.env.NODE_ENV === "development" ? " ws: wss:" : "";
const contentSecurityPolicy = [
	"default-src 'self'",
	"base-uri 'self'",
	`connect-src 'self'${developmentConnectSources}`,
	"font-src 'self' data:",
	"form-action 'self'",
	"frame-ancestors 'none'",
	"frame-src 'none'",
	"img-src 'self' data: blob: https://cdn1.hackthehill.com https://lh3.googleusercontent.com",
	"manifest-src 'self'",
	"media-src 'self' blob:",
	"object-src 'none'",
	`script-src 'self' 'unsafe-inline'${developmentScriptSources}`,
	"style-src 'self' 'unsafe-inline'",
	"worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
	{ key: "Content-Security-Policy", value: contentSecurityPolicy },
	{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
	{ key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=(), payment=(), usb=()" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-DNS-Prefetch-Control", value: "off" },
	{ key: "X-Frame-Options", value: "DENY" },
	...(process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL?.startsWith("https://")
		? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
		: []),
];

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

// Validate during Next config loading; src/env/server.mjs also validates any
// importing server route at build or request time. There is no validation bypass.
import("./src/env/server.mjs");

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
	poweredByHeader: false,
	i18n,
	distDir: process.env.NEXT_DIST_DIR || ".next",
	experimental: { useTypeScriptCli: false },
	turbopack: {},
	// Match the raw path once. Letting Next add an i18n prefix would miss `/`
	// and other default-locale document routes.
	headers: () =>
		Promise.resolve([{ source: "/:path*", locale: false, headers: securityHeaders }]),
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
