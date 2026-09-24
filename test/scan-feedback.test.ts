import assert from "node:assert/strict";
import test from "node:test";
import { playScanFeedback } from "@/client/scan-feedback";

type CapturedOscillator = {
	frequency: { value: number };
	type: string;
	startAt?: number;
	stopAt?: number;
	connect: <T>(target: T) => T;
	start: (at: number) => void;
	stop: (at: number) => void;
};

void test("scan feedback waits for audio, vibrates, and plays clear triangle tones", async t => {
	const originalWindow = globalThis.window;
	const vibrations: number[][] = [];
	const oscillators: CapturedOscillator[] = [];
	const gainEvents: Array<["set" | "ramp", number, number]> = [];

	class AudioContextStub {
		state = "suspended";
		currentTime = 2;
		destination = {};

		resume() {
			this.state = "running";
			return Promise.resolve();
		}

		createOscillator() {
			const oscillator: CapturedOscillator = {
				frequency: { value: 0 },
				type: "sine",
				connect: <T>(target: T) => target,
				start: (at: number) => {
					oscillator.startAt = at;
				},
				stop: (at: number) => {
					oscillator.stopAt = at;
				},
			};
			oscillators.push(oscillator);
			return oscillator;
		}

		createGain() {
			return {
				gain: {
					setValueAtTime: (value: number, at: number) => gainEvents.push(["set", value, at]),
					exponentialRampToValueAtTime: (value: number, at: number) => gainEvents.push(["ramp", value, at]),
				},
				connect: <T>(target: T) => target,
			};
		}
	}

	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			AudioContext: AudioContextStub,
			navigator: { vibrate: (pattern: number[]) => vibrations.push(pattern) },
		},
	});
	t.after(() => Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow }));

	await playScanFeedback("incremented");

	assert.deepEqual(vibrations, [[70, 40, 140]]);
	assert.deepEqual(
		oscillators.map(oscillator => [oscillator.frequency.value, oscillator.type]),
		[
			[587, "triangle"],
			[784, "triangle"],
			[988, "triangle"],
		],
	);
	assert.deepEqual(
		oscillators.map(oscillator => [
			Number(oscillator.startAt?.toFixed(2)),
			Number(oscillator.stopAt?.toFixed(2)),
		]),
		[
			[2, 2.2],
			[2.14, 2.34],
			[2.28, 2.48],
		],
	);
	assert.ok(gainEvents.some(([kind, value]) => kind === "ramp" && value === 0.2));
});
