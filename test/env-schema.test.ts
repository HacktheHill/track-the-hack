import assert from "node:assert/strict";
import test from "node:test";
import { resolveNextAuthUrl, serverSchema } from "../src/env/schema.mjs";

void test("an explicit NEXTAUTH_URL takes precedence over VERCEL_URL", () => {
	const previousVercelUrl = process.env.VERCEL_URL;
	process.env.VERCEL_URL = "preview.vercel.app";

	try {
		assert.equal(serverSchema.shape.NEXTAUTH_URL.parse("https://configured.example"), "https://configured.example");
		assert.equal(
			resolveNextAuthUrl("https://configured.example", "preview.vercel.app"),
			"https://configured.example",
		);
	} finally {
		if (previousVercelUrl === undefined) delete process.env.VERCEL_URL;
		else process.env.VERCEL_URL = previousVercelUrl;
	}
});

void test("VERCEL_URL becomes an absolute HTTPS URL when NEXTAUTH_URL is absent", () => {
	const previousVercelUrl = process.env.VERCEL_URL;
	process.env.VERCEL_URL = "preview.vercel.app";

	try {
		assert.equal(serverSchema.shape.NEXTAUTH_URL.parse(undefined), "https://preview.vercel.app");
	} finally {
		if (previousVercelUrl === undefined) delete process.env.VERCEL_URL;
		else process.env.VERCEL_URL = previousVercelUrl;
	}
});

void test("NEXTAUTH_URL remains required when no public URL is configured", () => {
	const previousVercelUrl = process.env.VERCEL_URL;
	delete process.env.VERCEL_URL;

	try {
		assert.equal(serverSchema.shape.NEXTAUTH_URL.safeParse(undefined).success, false);
	} finally {
		if (previousVercelUrl === undefined) delete process.env.VERCEL_URL;
		else process.env.VERCEL_URL = previousVercelUrl;
	}
});
