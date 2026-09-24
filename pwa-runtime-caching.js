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

module.exports = { apiNetworkOnly, publicScheduleData };
