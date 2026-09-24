import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { legacyRolesDestination } from "@/pages/internal/roles";

const sourceFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
	});

const relativeLuminance = (hex: string) => {
	const channels = hex
		.match(/[a-f\d]{2}/gi)
		?.map(channel => Number.parseInt(channel, 16) / 255)
		.map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
	assert.ok(channels && channels.length === 3);
	const [red, green, blue] = channels;
	if (red === undefined || green === undefined || blue === undefined)
		throw new Error("Expected a six-digit RGB colour");
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (first: string, second: string) => {
	const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
	const [lighter, darker] = values;
	if (lighter === undefined || darker === undefined) throw new Error("Expected two luminance values");
	return (lighter + 0.05) / (darker + 0.05);
};

void test("shared interactive colour pairs meet WCAG AA for normal text", () => {
	assert.ok(contrast("84010b", "ffffff") >= 4.5, "primary button text must meet 4.5:1");
	assert.ok(contrast("fff3b6", "650014") >= 4.5, "secondary button text must meet 4.5:1");
	assert.ok(contrast("f5c18c", "650014") >= 4.5, "panel text must meet 4.5:1");
	assert.ok(contrast("fff3b6", "805044") >= 4.5, "field placeholder text must meet 4.5:1");
});

void test("UI source does not use the known failing coral and white text pair", () => {
	for (const path of [...sourceFiles("src/pages"), ...sourceFiles("src/components")]) {
		const source = readFileSync(path, "utf8");
		assert.doesNotMatch(
			source,
			/(?:bg-light-primary-color[^\n"`]*text-light-color|text-light-color[^\n"`]*bg-light-primary-color)/,
			path,
		);
		assert.doesNotMatch(source, /bg-primary-color/, `${path} uses an undefined palette utility`);
	}
});

void test("sponsor details do not expose sponsorship tiers", () => {
	const source = readFileSync("src/pages/sponsors/[sponsor].tsx", "utf8");
	assert.doesNotMatch(source, /\btier\b/);
});

void test("the legacy organiser route preserves the selected locale", () => {
	assert.equal(legacyRolesDestination("fr", "en"), "/fr/internal/access");
	assert.equal(legacyRolesDestination("en", "en"), "/internal/access");
});
