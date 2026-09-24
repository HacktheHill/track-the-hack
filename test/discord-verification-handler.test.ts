import assert from "node:assert/strict";
import test from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import {
	createDiscordVerificationHandler,
	type DiscordVerificationDependencies,
} from "@/server/http/discord-verification-handler";

const participant = { hackerId: "participant-1" };

const responseMock = () => {
	const state: { statusCode: number; body?: unknown; headers: Record<string, unknown> } = {
		statusCode: 0,
		headers: {},
	};
	// Partial API response mock exposes only the methods exercised by the handler.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const response = {
		setHeader(name: string, value: unknown) {
			state.headers[name] = value;
		},
		status(code: number) {
			state.statusCode = code;
			return response;
		},
		json(body: unknown) {
			state.body = body;
			return response;
		},
	} as unknown as NextApiResponse;
	return { state, response };
};

const request = (method: string, body?: unknown, headers: Record<string, string> = {}) => {
	// Partial API request mock exposes only the fields exercised by the handler.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return { method, body, headers } as unknown as NextApiRequest;
};

const dependencies = (
	overrides: Partial<DiscordVerificationDependencies> = {},
): DiscordVerificationDependencies => ({
	expectedOrigin: "https://tracker.example",
	configured: true,
	readParticipantSession: () => Promise.resolve(participant),
	hasCheckedIn: () => Promise.resolve(true),
	complete: () => Promise.resolve("verified"),
	...overrides,
});

void test("read-only eligibility requires both a participant session and a positive check-in", async () => {
	for (const [deps, expectedStatus, expectedBody] of [
		[
			dependencies({ readParticipantSession: () => Promise.resolve(null) }),
			401,
			{ status: "session-required" },
		],
		[dependencies({ hasCheckedIn: () => Promise.resolve(false) }), 403, { status: "check-in-required" }],
		[dependencies(), 200, { status: "eligible" }],
	] as const) {
		const result = responseMock();
		await createDiscordVerificationHandler(deps)(request("GET"), result.response);
		assert.equal(result.state.statusCode, expectedStatus);
		assert.deepEqual(result.state.body, expectedBody);
		assert.equal(result.state.headers["Cache-Control"], "no-store");
	}
});

void test("POST repeats the check-in gate before completing a Discord verification", async t => {
	const complete = t.mock.fn(() => Promise.resolve<"verified">("verified"));
	const unchecked = responseMock();
	await createDiscordVerificationHandler(
		dependencies({ hasCheckedIn: () => Promise.resolve(false), complete }),
	)(request("POST", { token: "private-token" }, { "content-type": "application/json" }), unchecked.response);
	assert.equal(unchecked.state.statusCode, 403);
	assert.deepEqual(unchecked.state.body, { status: "check-in-required" });
	assert.equal(complete.mock.callCount(), 0);

	const checked = responseMock();
	await createDiscordVerificationHandler(dependencies({ complete }))(
		request("POST", { token: "private-token" }, { "content-type": "application/json" }),
		checked.response,
	);
	assert.equal(checked.state.statusCode, 200);
	assert.deepEqual(checked.state.body, { status: "verified" });
	assert.deepEqual(complete.mock.calls[0]?.arguments, ["private-token", participant.hackerId]);
});

void test("POST rejects non-JSON and cross-origin requests before reading participant state", async t => {
	const readParticipantSession = t.mock.fn(() => Promise.resolve(participant));
	const invalidHeaders: Record<string, string>[] = [
		{},
		{ "content-type": "application/json", origin: "https://attacker.example" },
	];
	for (const headers of invalidHeaders) {
		const result = responseMock();
		await createDiscordVerificationHandler(dependencies({ readParticipantSession }))(
			request("POST", { token: "private-token" }, headers),
			result.response,
		);
		assert.equal(result.state.statusCode, 403);
		assert.deepEqual(result.state.body, { status: "invalid" });
	}
	assert.equal(readParticipantSession.mock.callCount(), 0);
});
