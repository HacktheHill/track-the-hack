import assert from "node:assert/strict";
import test from "node:test";
import { createRsvpManagementHandler } from "@/server/http/rsvp-management-handler";
import { ParticipantLifecycleError } from "@/server/services/hacker-lifecycle";

const response = () => {
	let code = 200;
	let body: unknown;
	const headers: Record<string, string> = {};
	const res = {
		setHeader(name: string, value: string) { headers[name] = value; },
		status(value: number) { code = value; return res; },
		json(value: unknown) { body = value; },
	};
	return { res, code: () => code, body: () => body, headers };
};

void test("opening management with GET cannot read or change state", async () => {
	let calls = 0;
	const handler = createRsvpManagementHandler({
		read: () => { calls++; return Promise.resolve({ status: "PENDING", canAttend: true }); },
		decide: () => { calls++; return Promise.resolve({ status: "CONFIRMED", canAttend: true }); },
	});
	const result = response();
	await handler({ method: "GET", body: undefined }, result.res);
	assert.equal(result.code(), 405);
	assert.equal(calls, 0);
	assert.equal(result.headers["Cache-Control"], "no-store");
	assert.equal(result.headers["Referrer-Policy"], "no-referrer");
});

void test("status reads only; explicit attend and decline choose separately", async () => {
	const calls: string[] = [];
	const handler = createRsvpManagementHandler({
		read: token => { calls.push(`read:${token}`); return Promise.resolve({ status: "PENDING", canAttend: true }); },
		decide: (token, attending) => { calls.push(`${String(attending)}:${token}`); return Promise.resolve({ status: attending ? "CONFIRMED" : "DECLINED", canAttend: true }); },
	});
	for (const action of ["status", "attend", "decline"]) {
		const result = response();
		await handler({ method: "POST", body: { token: "private", action } }, result.res);
		assert.equal(result.code(), 200);
	}
	assert.deepEqual(calls, ["read:private", "true:private", "false:private"]);
});

void test("invalid bodies and expired attendance fail without exposing tokens", async () => {
	const handler = createRsvpManagementHandler({
		read: () => Promise.reject(new ParticipantLifecycleError("INVALID_CANCELLATION_CAPABILITY")),
		decide: () => Promise.reject(new ParticipantLifecycleError("INVALID_OR_EXPIRED_INVITATION")),
	});
	const malformed = response();
	await handler({ method: "POST", body: { token: "private", action: "anything" } }, malformed.res);
	assert.equal(malformed.code(), 400);
	const expired = response();
	await handler({ method: "POST", body: { token: "private", action: "attend" } }, expired.res);
	assert.equal(expired.code(), 409);
	assert.doesNotMatch(JSON.stringify(expired.body()), /private/);
});
