import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";

// The security override crosses the selector parser's major-version boundary.
// Exercise the AST transformations used by all three sites, including the group
// variants that previously regressed in postcss-selector-parser 6.1.3/7.1.3.
for (const configPath of [
	"tailwind.config.mjs",
	"archive/tailwind.config.cjs",
	"private-metrics/tailwind.config.cjs",
]) {
	void test(`${configPath} preserves selector transformations with the patched parser`, async () => {
		const config = loadConfig(path.resolve(configPath));
		const result = await postcss([
			tailwindcss({
				...config,
				content: [
					{
						raw: "group-open:rotate-45 group-hover:bg-dark-primary-color peer-checked:hidden mobile:hover:bg-dark-primary-color [&>span]:font-bold security-fixture",
						extension: "html",
					},
				],
			}),
		]).process("@tailwind utilities; .security-fixture { @apply px-4 py-2 rounded-md; }", {
			from: undefined,
		});

		const selectors = new Set<string>();
		result.root.walkRules(rule => {
			selectors.add(rule.selector);
		});
		for (const selector of [
			".group[open] .group-open\\:rotate-45",
			".group:hover .group-hover\\:bg-dark-primary-color",
			".peer:checked ~ .peer-checked\\:hidden",
			".mobile\\:hover\\:bg-dark-primary-color:hover",
			".\\[\\&\\>span\\]\\:font-bold>span",
			".security-fixture",
		]) {
			assert.ok(selectors.has(selector), `Missing selector: ${selector}`);
		}
		assert.match(result.css, /@media \(min-width: 900px\)/);
		assert.match(result.css, /background-color: rgb\(132 1 11/);
		assert.match(result.css, /padding-left: 1rem/);
		assert.match(result.css, /padding-top: 0\.5rem/);
		assert.ok(!result.css.includes("@apply"));
		assert.equal(result.warnings().length, 0);
	});
}
