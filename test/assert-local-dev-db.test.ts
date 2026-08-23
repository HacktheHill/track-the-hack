import assert from "node:assert/strict";
import test from "node:test";
import { assertLocalDevDatabase } from "@root/scripts/assert-local-dev-db.mjs";

void test("local dev database guard accepts only the expected loopback MySQL database", () => {
	for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
		assert.doesNotThrow(() => assertLocalDevDatabase(`mysql://root:password@${hostname}/track-the-hack`));
	}
});

void test("local dev database guard rejects unsafe targets", () => {
	for (const databaseUrl of [
		"mysql://root:password@db.example.com/track-the-hack",
		"mysql://root:password@localhost/production",
		"postgresql://root:password@localhost/track-the-hack",
		"not a URL",
		undefined,
	]) {
		assert.throws(() => assertLocalDevDatabase(databaseUrl), /Refusing dev setup/);
	}
});
