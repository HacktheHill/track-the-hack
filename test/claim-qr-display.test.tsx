import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { z } from "zod";
import { useClaimQrDisplay } from "@/hooks/useClaimQrDisplay";

const displayStateSchema = z.object({
	claimUrl: z.string(),
	secondsRemaining: z.number().nullable(),
});

void test("the same QR page updates for a new claim and clears it at expiry", t => {
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const listeners = new Map<string, () => void>();
	const location = {
		origin: "https://track.example",
		hash: "#first-token",
		search: "?expiresAt=2030-09-15T00%3A05%3A00.000Z",
	};
	let tick: () => void = () => undefined;
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			location,
			addEventListener: (name: string, handler: () => void) => listeners.set(name, handler),
			removeEventListener: (name: string) => listeners.delete(name),
			setInterval: (handler: () => void) => {
				tick = handler;
				return 1;
			},
			clearInterval: () => undefined,
		},
	});
	t.after(() => {
		if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
		else Reflect.deleteProperty(globalThis, "window");
	});

	let clock = Date.parse("2030-09-15T00:00:00.000Z");
	t.mock.method(Date, "now", () => clock);
	const Host = () => {
		const { claimUrl, secondsRemaining } = useClaimQrDisplay();
		return createElement("output", { claimUrl, secondsRemaining });
	};
	let renderer: ReactTestRenderer | null = null;
	void act(() => {
		renderer = create(createElement(Host));
	});
	assert.ok(renderer);
	const state = () => {
		assert.ok(renderer);
		return displayStateSchema.parse(renderer.root.findByType("output").props);
	};
	assert.equal(state().claimUrl, "https://track.example/claim#first-token");
	assert.equal(state().secondsRemaining, 300);

	location.hash = "#second-token";
	location.search = "?expiresAt=2030-09-15T00%3A06%3A00.000Z";
	void act(() => listeners.get("hashchange")?.());
	assert.equal(state().claimUrl, "https://track.example/claim#second-token");
	assert.equal(state().secondsRemaining, 360);

	clock = Date.parse("2030-09-15T00:06:00.000Z");
	void act(() => tick());
	assert.equal(state().secondsRemaining, 0);

	void act(() => renderer?.unmount());
	assert.equal(listeners.size, 0);
});
