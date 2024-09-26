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
	disable: process.env.NODE_ENV === "development",
});

module.exports = withPWA({
	reactStrictMode: true,
	swcMinify: true,
	i18n,
	webpack: config => {
		config.module.rules.push({
			test: /\.md$/,
			use: "raw-loader",
		});
		return config;
	},

	images: {
		domains: ["cdn1.hackthehill.com", "2024.hackthehill.com"],
	},
});
