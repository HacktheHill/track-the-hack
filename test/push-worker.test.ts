import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

type WorkerEvent = { data?: object; notification?: object; waitUntil: (work: Promise<unknown>) => void };
void test("custom worker displays push payloads and focuses the linked event", async () => {
	const listeners = new Map<string, (event: WorkerEvent) => void>();
	let displayed: unknown;
	let work: Promise<unknown> | undefined;
	let focused = false;
	let closed = false;
	const target = "https://track.example/schedule/event?id=event-1";
	runInNewContext(readFileSync("worker/index.js", "utf8"), {
		URL,
		self: {
			location: { origin: "https://track.example" },
			addEventListener: (name: string, callback: (event: WorkerEvent) => void) => listeners.set(name, callback),
			registration: {
				showNotification: (title: string, options: unknown) => {
					displayed = { title, options };
					return Promise.resolve();
				},
			},
			clients: {
				matchAll: () =>
					Promise.resolve([
						{
							url: target,
							focus: () => {
								focused = true;
								return Promise.resolve();
							},
						},
					]),
			},
		},
	});
	listeners.get("push")?.({
		data: {
			json: () => ({
				title: "Opening",
				body: "Starting now",
				tag: "event-1",
				data: { url: "/schedule/event?id=event-1" },
			}),
		},
		waitUntil: promise => {
			work = promise;
		},
	});
	await work;
	assert.deepEqual(JSON.parse(JSON.stringify(displayed)), {
		title: "Opening",
		options: { body: "Starting now", tag: "event-1", data: { url: "/schedule/event?id=event-1" } },
	});
	listeners.get("notificationclick")?.({
		notification: {
			close() {
				closed = true;
			},
			data: { url: "/schedule/event?id=event-1" },
		},
		waitUntil: promise => {
			work = promise;
		},
	});
	await work;
	assert.equal(focused, true);
	assert.equal(closed, true);
});
