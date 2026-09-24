import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { EventType, MealCategory, ScannerWorkflow } from "@prisma/client";

type TranslationTree = { [key: string]: string | TranslationTree };

const isTranslationTree = (value: unknown): value is TranslationTree =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	Object.values(value).every(child => typeof child === "string" || isTranslationTree(child));

const readLocale = (locale: "en" | "fr", namespace: string) => {
	const parsed: unknown = JSON.parse(readFileSync(`public/locales/${locale}/${namespace}.json`, "utf8"));
	assert.ok(isTranslationTree(parsed), `${locale}/${namespace}.json must contain only nested string translations`);
	return parsed;
};

const flattenKeys = (tree: TranslationTree, prefix = ""): string[] =>
	Object.entries(tree).flatMap(([key, value]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		return typeof value === "string" ? [path] : flattenKeys(value, path);
	});

const hasKey = (tree: TranslationTree, path: string): boolean => {
	const [segment, ...remaining] = path.split(".");
	if (segment === undefined) return false;
	const value = tree[segment];
	if (value === undefined) return false;
	if (remaining.length === 0) return typeof value === "string";
	return typeof value === "string" ? false : hasKey(value, remaining.join("."));
};

void test("English and French locale namespaces have identical key sets", () => {
	const english = readdirSync("public/locales/en")
		.filter(file => file.endsWith(".json"))
		.sort();
	const french = readdirSync("public/locales/fr")
		.filter(file => file.endsWith(".json"))
		.sort();
	assert.deepEqual(french, english);
	for (const file of english) {
		const namespace = file.slice(0, -5);
		assert.deepEqual(
			flattenKeys(readLocale("fr", namespace)).sort(),
			flattenKeys(readLocale("en", namespace)).sort(),
			`${namespace} locale keys differ`,
		);
	}
});

void test("dynamic enum-backed translation domains cover every runtime value", () => {
	const domains = [
		["event", "type", Object.values(EventType)],
		["internal", "events.type-values", Object.values(EventType)],
		["internal", "events.scanner-workflow-values", Object.values(ScannerWorkflow)],
		["qr", "workflow", Object.values(ScannerWorkflow)],
		["qr", "meal-category", Object.values(MealCategory)],
		["profile", "meal-category", Object.values(MealCategory)],
		["qr", "scan-outcome", ["new", "incremented", "unchanged", "limit"]],
		["rsvp", "", ["manage-status-pending", "manage-status-confirmed", "manage-status-declined"]],
		["discord", "", ["verified", "session-required", "invalid", "conflict", "unavailable"]],
	] as const;
	for (const locale of ["en", "fr"] as const) {
		for (const [namespace, prefix, values] of domains) {
			const translations = readLocale(locale, namespace);
			for (const value of values) {
				const path = [prefix, value].filter(Boolean).join(".");
				assert.equal(hasKey(translations, path), true, `${locale} missing ${namespace}:${path}`);
			}
		}
	}
});
