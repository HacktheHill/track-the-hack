import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { createElement, Profiler } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getQueryKey } from "@trpc/react-query";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import { trpc } from "@/server/api/api";
import { event, setup } from "@root/test/helpers/event-ui";

void test("a saved reminder remains active when refetch recreates the event object", async t => {
	const { queryClient, wrap } = await setup(t);
	const browser = {
		localStorage: { getItem: () => JSON.stringify([event.id]), setItem: () => undefined },
		Notification: { permission: "granted" },
		PushManager: class PushManager {},
		requestIdleCallback: (callback: () => void) => globalThis.setTimeout(callback, 0),
		cancelIdleCallback: (handle: ReturnType<typeof globalThis.setTimeout>) => globalThis.clearTimeout(handle),
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	};
	const serviceWorker = {
		getRegistration: () =>
			Promise.resolve({
				pushManager: { getSubscription: () => Promise.resolve({ endpoint: "https://push.test" }) },
			}),
	};
	const globals = ["window", "self", "navigator", "Notification", "fetch"] as const;
	const previousGlobals = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
	Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
	Object.defineProperty(globalThis, "self", { configurable: true, value: browser });
	const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
	Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "" } });
	Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker } });
	Object.defineProperty(globalThis, "Notification", {
		configurable: true,
		value: { permission: "granted", requestPermission: () => Promise.resolve("granted") },
	});
	Object.defineProperty(globalThis, "fetch", {
		configurable: true,
		value: () =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ available: true, publicKey: "test-vapid-key" }),
			}),
	});
	t.after(() => {
		if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
		else Reflect.deleteProperty(globalThis, "document");
		for (const [name, descriptor] of previousGlobals) {
			if (descriptor) Object.defineProperty(globalThis, name, descriptor);
			else Reflect.deleteProperty(globalThis, name);
		}
	});

	queryClient.setQueryData(getQueryKey(trpc.events.all, undefined, "query"), [event]);
	const router = {
		route: "/schedule/event",
		pathname: "/schedule/event",
		query: { id: event.id },
		asPath: `/schedule/event?id=${event.id}`,
		basePath: "",
		locale: "en",
		locales: ["en", "fr"],
		defaultLocale: "en",
		isFallback: false,
		isReady: true,
		isPreview: false,
		isLocaleDomain: false,
		push: () => Promise.resolve(true),
		replace: () => Promise.resolve(true),
		reload: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => Promise.resolve(),
		beforePopState: () => undefined,
		events: { on: () => undefined, off: () => undefined, emit: () => undefined },
	} satisfies NextRouter;
	const { default: ScheduleEventDetails } = await import("@/components/ScheduleEventDetails");
	const snapshots: boolean[] = [];
	let renderer: ReactTestRenderer | undefined;
	await act(() => {
		renderer = create(
			wrap(
				createElement(
					RouterContext.Provider,
					{ value: router },
					createElement(
						Profiler,
						{
							id: "details",
							onRender: () => {
								if (!renderer) return;
								const button = renderer.root
									.findAllByType("button")
									.find(item => item.props["aria-pressed"] !== undefined);
								if (button) snapshots.push(button.props["aria-pressed"] === true);
							},
						},
						createElement(ScheduleEventDetails, { id: event.id }),
					),
				),
			),
		);
	});
	const rendered = renderer;
	assert.ok(rendered);
	t.after(() => rendered.unmount());
	const flush = async (action: () => void) => {
		await act(async () => {
			action();
			await setTimeout(0);
		});
	};
	await flush(() => undefined);
	assert.equal(
		rendered.root.findAllByType("button").find(item => item.props["aria-pressed"] !== undefined)?.props[
			"aria-pressed"
		],
		true,
	);

	snapshots.length = 0;
	await flush(() => {
		queryClient.setQueryData(getQueryKey(trpc.events.all, undefined, "query"), [
			{ ...event, name: "Opening ceremony (refetched)", start: new Date(event.start.getTime()) },
		]);
	});
	assert.ok(snapshots.length > 0, "the event detail rerendered with refreshed data");
	assert.ok(
		snapshots.every(requested => requested === true),
		"the reminder never becomes inactive during refetch",
	);
});
