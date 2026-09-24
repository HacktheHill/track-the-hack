import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import {
	readDiscordEligibility,
	type DiscordEligibility,
	useDiscordEligibility,
} from "@/utils/discord-eligibility";

void test("eligibility responses preserve session and check-in failures", async () => {
	for (const [status, expected] of [
		[200, "eligible"],
		[401, "session-required"],
		[403, "check-in-required"],
		[503, "unavailable"],
	] as const) {
		const send = () => Promise.resolve(new Response(null, { status }));
		assert.equal(await readDiscordEligibility(send), expected);
	}
});

void test("eligibility rechecks until a completed check-in enables verification", async t => {
	const browser = new EventTarget();
	const page = new EventTarget();
	Object.defineProperty(page, "visibilityState", { configurable: true, value: "visible" });
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
	Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
	Object.defineProperty(globalThis, "document", { configurable: true, value: page });
	t.after(() => {
		if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
		else Reflect.deleteProperty(globalThis, "window");
		if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
		else Reflect.deleteProperty(globalThis, "document");
	});

	const responses: DiscordEligibility[] = ["check-in-required", "eligible"];
	const check = t.mock.fn(() => Promise.resolve(responses.shift() ?? "eligible"));
	const renderedStates: DiscordEligibility[] = [];
	const Probe = () => {
		const state = useDiscordEligibility(check, 5);
		renderedStates.push(state);
		return createElement("span", null, state);
	};

	let renderer: ReturnType<typeof create> | undefined;
	await act(async () => {
		renderer = create(createElement(Probe));
		await wait(20);
	});
	assert.ok(check.mock.callCount() >= 2);
	assert.equal(renderedStates.at(-1), "eligible");
	await act(() => renderer?.unmount());
});
