// @ts-check

// The only API response allowed into a runtime cache is the public,
// server-filtered schedule. Keeping it out of a tRPC batch prevents a cached
// response from ever carrying participant or organiser data alongside it.
/** @type {(context: { request: Request; url: URL }) => boolean} */
const isPublicScheduleRequest = ({ request, url }) =>
	request.method === "GET" && self.origin === url.origin && url.pathname === "/api/trpc/events.all";

/** @satisfies {import("workbox-build").RuntimeCaching} */
const publicScheduleData = {
	urlPattern: isPublicScheduleRequest,
	handler: "NetworkFirst",
	options: {
		cacheName: "public-schedule-data",
		networkTimeoutSeconds: 5,
		cacheableResponse: { statuses: [200] },
		expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
	},
};

// All other API responses may contain authenticated participant or organiser data.
/** @type {(context: { url: URL }) => boolean} */
const isApiRequest = ({ url }) =>
	self.origin === url.origin && (url.pathname === "/api" || url.pathname.startsWith("/api/"));

/** @satisfies {import("workbox-build").RuntimeCaching} */
const apiNetworkOnly = {
	urlPattern: isApiRequest,
	handler: "NetworkOnly",
	options: { cacheName: "private-api-network-only" },
};

// Workbox serializes these match callbacks into the generated service worker.
// Each callback must therefore be self-contained and may not close over a local
// helper, set, or regular expression.
/** @param {{ request: Request; url: URL }} context */
const isFrenchPublicNavigation = ({ request, url }) =>
	request.mode === "navigate" &&
	self.origin === url.origin &&
	/^\/fr(?:\/(?:schedule(?:\/event)?|maps|resources|sponsors|pass))?\/?$/.test(url.pathname);
/** @param {{ request: Request; url: URL }} context */
const isEnglishPublicNavigation = ({ request, url }) =>
	request.mode === "navigate" &&
	self.origin === url.origin &&
	/^\/(?:schedule(?:\/event)?|maps|resources|sponsors|pass)?\/?$/.test(url.pathname);
/** @param {{ request: Request; url: URL }} context */
const isFrenchPrivateNavigation = ({ request, url }) =>
	request.mode === "navigate" &&
	self.origin === url.origin &&
	/^\/fr\/(?:auth\/(?:error|sign-in)|cancel|claim(?:\/qr)?|discord|internal(?:\/(?:events|roles))?|metrics|profile|qr|rsvp\/(?:manage|[^/]+))\/?$/.test(
		url.pathname,
	);
/** @param {{ request: Request; url: URL }} context */
const isEnglishPrivateNavigation = ({ request, url }) =>
	request.mode === "navigate" &&
	self.origin === url.origin &&
	/^\/(?:auth\/(?:error|sign-in)|cancel|claim(?:\/qr)?|discord|internal(?:\/(?:events|roles))?|metrics|profile|qr|rsvp\/(?:manage|[^/]+))\/?$/.test(
		url.pathname,
	);
/** @param {{ url: URL }} context */
const isPrivateNextDataRequest = ({ url }) =>
	self.origin === url.origin &&
	/^\/_next\/data\/[^/]+\/(?:(?:en|fr)\/)?(?:auth\/(?:error|sign-in)|cancel|claim(?:\/qr)?|discord|internal(?:\/(?:events|roles))?|metrics|profile|qr|rsvp\/(?:manage|[^/]+))\.json$/.test(
		url.pathname,
	);

module.exports = {
	apiNetworkOnly,
	publicScheduleData,
	isEnglishPrivateNavigation,
	isEnglishPublicNavigation,
	isFrenchPrivateNavigation,
	isFrenchPublicNavigation,
	isPrivateNextDataRequest,
};
