// @ts-check
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { i18n } = require("./next-i18next.config.js");

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
!process.env.SKIP_ENV_VALIDATION && import("./src/env/server.mjs");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withPWA = require("next-pwa")({
	dest: "public",
	register: true,
	disable: false,
});

module.exports = withPWA({
	reactStrictMode: true,
	pwa: {
		dest: "public",
		register: true,
		skipWaiting: true,
	},
	swcMinify: true,
	i18n,
});
