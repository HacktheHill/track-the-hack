// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const loadConfig = require("tailwindcss/loadConfig");
const shared = loadConfig(path.join(__dirname, "../tailwind.config.mjs"));
module.exports = {
	...shared,
	content: [
		path.join(__dirname, "../src/components/metrics/**/*.{ts,tsx}"),
		path.join(__dirname, "../src/pages/metrics/**/*.{ts,tsx}"),
		path.join(__dirname, "**/*.{ts,tsx}"),
	],
};
