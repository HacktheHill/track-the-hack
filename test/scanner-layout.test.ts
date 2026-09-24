import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// A flex column that centres and scrolls in the same box hides everything above
// the scroll origin, so the event selector fell out of reach on phone widths.
const centredScrollContainers = (source: string) =>
	[...source.matchAll(/className="([^"]*)"/g)]
		.map(match => (match[1] ?? "").split(/\s+/))
		.filter(
			classes =>
				classes.includes("justify-center") &&
				classes.some(candidate => /^overflow-(y-)?(auto|scroll)$/.test(candidate)),
		);

void test("scanner page centres its column without trapping content above the scroll origin", () => {
	const source = readFileSync("src/pages/qr/index.tsx", "utf8");
	const manual = readFileSync("src/components/PhysicalScanner.tsx", "utf8");

	assert.deepEqual(centredScrollContainers(source), []);
	assert.match(source, /overflow-y-auto/);
	assert.match(source, /className="my-auto [^"]*flex-col/);
	assert.match(manual, /placeholder=\{t\("manual-placeholder"\)\}/);
	assert.doesNotMatch(manual, /<button/);
});
