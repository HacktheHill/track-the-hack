/** @type {import("prettier").Config} */
module.exports = {
	plugins: [require.resolve("prettier-plugin-tailwindcss")],
	printWidth: 120,
	tabWidth: 4,
	semi: true,
	useTabs: true,
	singleQuote: false,
	trailingComma: "all",
	bracketSpacing: true,
	jsxBracketSameLine: false,
	arrowParens: "avoid",
	proseWrap: "preserve",
};
