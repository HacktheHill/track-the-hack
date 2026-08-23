// @ts-check

// API responses may contain authenticated participant and organizer data.
/** @type {(context: { url: URL }) => boolean} */
const isApiRequest = ({ url }) =>
	self.origin === url.origin && (url.pathname === "/api" || url.pathname.startsWith("/api/"));

const apiNetworkOnly = {
	urlPattern: isApiRequest,
	handler: "NetworkOnly",
};

module.exports = apiNetworkOnly;
