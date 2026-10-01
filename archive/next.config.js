// @ts-check
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("node:path");

/** @type {import('next').NextConfig} */
module.exports = {
	output: "export",
	trailingSlash: true,
	poweredByHeader: false,
	images: { unoptimized: true },
	typescript: { tsconfigPath: "tsconfig.json" },
	experimental: { externalDir: true, useTypeScriptCli: false },
	/** @param {import('webpack').Configuration} config */
	webpack: config => {
		// Only the archive build substitutes the authentication-free shell.
		config.resolve ??= {};
		config.resolve.alias = {
			...config.resolve.alias,
			"@/components/App$": path.join(__dirname, "components/App.tsx"),
		};
		config.module ??= {};
		config.module.rules ??= [];
		config.module.rules.push({ test: /\.md$/, use: "raw-loader" });
		return config;
	},
};
