/* eslint-disable @typescript-eslint/consistent-type-assertions */
import assert from "node:assert/strict";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { TestContext } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import webPush from "web-push";

import handler, { config as pushApiConfig } from "@/pages/api/push/register";
import {
	getPushConfiguration,
	hasValidPushKeys,
	PushRegistrationClosedError,
	PushSubscriptionLimitError,
	isAllowedPushEndpoint,
	registerEventPushSubscription,
	sendDueEventNotifications,
	unregisterEventPushSubscription,
} from "@/server/push";
import {
	getRequestedEventNotifications,
	isEventNotificationRequested,
	isPushServerAvailable,
	updateEventNotification,
} from "@/utils/event-notifications";

const vapid = webPush.generateVAPIDKeys();
const browserKey = createECDH("prime256v1");
const validKeys = {
	p256dh: browserKey.generateKeys().toString("base64url"),
	auth: randomBytes(16).toString("base64url"),
};
const configured = {
	publicKey: vapid.publicKey,
	privateKey: vapid.privateKey,
	clientPublicKey: vapid.publicKey,
	email: "",
};
const enablePush = (t: TestContext) => {
	for (const [key, value] of Object.entries({
		VAPID_PUBLIC_KEY: vapid.publicKey,
		VAPID_PRIVATE_KEY: vapid.privateKey,
		NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
	})) {
		const previous = process.env[key];
		t.after(() => {
			if (previous === undefined) delete process.env[key];
			else process.env[key] = previous;
		});
		process.env[key] = value;
	}
};

void test("readiness requires a valid matching VAPID pair and matching browser key", () => {
	assert.ok(getPushConfiguration(configured));
	assert.equal(getPushConfiguration({ ...configured, privateKey: undefined }), null);
	assert.equal(getPushConfiguration({ ...configured, privateKey: "invalid" }), null);
	assert.equal(getPushConfiguration({ ...configured, privateKey: webPush.generateVAPIDKeys().privateKey }), null);
	assert.equal(getPushConfiguration({ ...configured, clientPublicKey: "stale-browser-key" }), null);
	assert.equal(getPushConfiguration({ ...configured, email: "invalid" }), null);
});

void test("supported push endpoints reject private hosts, spoofed domains, userinfo and alternate ports", () => {
	const endpointPrefix = "https://fcm.googleapis.com/";
	assert.equal(isAllowedPushEndpoint(`${endpointPrefix}${"x".repeat(512 - endpointPrefix.length)}`), true);
	assert.equal(isAllowedPushEndpoint(`${endpointPrefix}${"x".repeat(513 - endpointPrefix.length)}`), false);
	for (const url of [
		"https://fcm.googleapis.com/token",
		"https://android.googleapis.com/token",
		"https://updates.push.services.mozilla.com/token",
		"https://web.push.apple.com/token",
		"https://db5p.notify.windows.com/token",
		"https://client.wns.windows.com/token",
	])
		assert.equal(isAllowedPushEndpoint(url), true, url);
	for (const url of [
		"http://fcm.googleapis.com/token",
		"https://localhost/token",
		"https://127.0.0.1/token",
		"https://10.0.0.1/token",
		"https://192.168.1.1/token",
		"https://169.254.169.254/token",
		"https://[::1]/token",
		"https://metadata.google.internal/token",
		"https://evil-push.apple.com/token",
		"https://push.apple.com.attacker.com/token",
		"https://fcm.googleapis.com.attacker.com/token",
		"https://user:pass@fcm.googleapis.com/",
		"https://fcm.googleapis.com:8443/",
		"",
		"invalid",
	])
		assert.equal(isAllowedPushEndpoint(url), false, url);
});

void test("push keys must be canonical base64url and contain a valid uncompressed P-256 point", () => {
	assert.equal(hasValidPushKeys(validKeys), true);
	assert.equal(hasValidPushKeys({ ...validKeys, p256dh: `${validKeys.p256dh}=` }), false);
	assert.equal(hasValidPushKeys({ ...validKeys, p256dh: `_${validKeys.p256dh.slice(1)}` }), false);
	assert.equal(hasValidPushKeys({ ...validKeys, p256dh: randomBytes(64).toString("base64url") }), false);
	const offCurveKey = Buffer.alloc(65);
	offCurveKey[0] = 0x04;
	assert.equal(hasValidPushKeys({ ...validKeys, p256dh: offCurveKey.toString("base64url") }), false);
	assert.equal(hasValidPushKeys({ ...validKeys, auth: randomBytes(15).toString("base64url") }), false);
	assert.equal(hasValidPushKeys({ ...validKeys, auth: `${validKeys.auth.slice(0, -1)}+` }), false);
});

const api = async (method: string, body?: unknown) => {
	let status = 200;
	let json: unknown;
	const headers = new Map<string, unknown>();
	const response = {
		setHeader: (key: string, value: unknown) => headers.set(key, value),
		status: (code: number) => {
			status = code;
			return response;
		},
		json: (value: unknown) => {
			json = value;
			return response;
		},
	};
	await handler({ method, body } as NextApiRequest, response as unknown as NextApiResponse);
	return { status, json, headers };
};

void test("API status is noncacheable and registration rejects unavailable or mismatched configuration", async t => {
	enablePush(t);
	const ready = await api("GET");
	assert.deepEqual(ready.json, { available: true, publicKey: vapid.publicKey });
	assert.equal(ready.headers.get("Cache-Control"), "no-store");
	const request = {
		eventId: "event",
		enabled: true,
		locale: "en",
		publicKey: "stale-key",
		subscription: { endpoint: "https://fcm.googleapis.com/token", keys: validKeys },
	};
	assert.equal((await api("POST", request)).status, 503);
	delete process.env.VAPID_PRIVATE_KEY;
	assert.deepEqual((await api("GET")).json, { available: false, publicKey: null });
	assert.equal((await api("POST", { ...request, publicKey: vapid.publicKey })).status, 503);
	assert.equal(
		await sendDueEventNotifications(),
		0,
		"unconfigured sender must not read or complete pending reminders",
	);
});

void test("API rejects SSRF and empty unsubscribe without accessing the database", async () => {
	assert.equal(pushApiConfig.api.bodyParser.sizeLimit, "4kb");
	assert.equal((await api("PUT")).status, 405);
	assert.equal((await api("POST", { eventId: "event", enabled: false, subscription: {} })).status, 400);
	assert.equal((await api("POST", { eventId: "event", enabled: false, subscription: { endpoint: "" } })).status, 400);
	assert.equal(
		(
			await api("POST", {
				eventId: "event",
				enabled: true,
				subscription: { endpoint: "https://169.254.169.254/token", keys: { p256dh: "key", auth: "key" } },
			})
		).status,
		400,
	);
	for (const body of [
		{ eventId: "x".repeat(192), enabled: false, subscription: { endpoint: "https://fcm.googleapis.com/x" } },
		{
			eventId: "event",
			enabled: true,
			locale: "en",
			publicKey: vapid.publicKey,
			subscription: { endpoint: `https://fcm.googleapis.com/${"x".repeat(490)}`, keys: validKeys },
		},
		{
			eventId: "event",
			enabled: true,
			locale: "en",
			publicKey: vapid.publicKey,
			subscription: {
				endpoint: "https://fcm.googleapis.com/x",
				keys: { ...validKeys, auth: `${validKeys.auth}a` },
			},
		},
		{
			eventId: "event",
			enabled: false,
			publicKey: vapid.publicKey,
			subscription: { endpoint: "https://fcm.googleapis.com/x" },
		},
		{
			eventId: "event",
			enabled: true,
			locale: "es",
			publicKey: vapid.publicKey,
			subscription: { endpoint: "https://fcm.googleapis.com/x", keys: validKeys },
		},
	])
		assert.equal((await api("POST", body)).status, 400);
	await unregisterEventPushSubscription("event", "");
});

void test("registration cap rejects only new endpoints and preserves stable conflict details", async () => {
	const endpoint = "https://fcm.googleapis.com/existing";
	let upserts = 0;
	const transaction = {
		$queryRaw: () => Promise.resolve([{ id: "event" }]),
		pushSubscription: {
			findUnique: ({ where }: { where: { eventId_endpoint: { endpoint: string } } }) =>
				Promise.resolve(where.eventId_endpoint.endpoint === endpoint ? { id: "subscription" } : null),
			count: () => Promise.resolve(5_000),
			upsert: () => {
				upserts++;
				return Promise.resolve({});
			},
		},
	};
	const prisma = {
		$transaction: (work: (client: typeof transaction) => Promise<void>) => work(transaction),
	} as unknown as PrismaClient;
	await registerEventPushSubscription("event", { endpoint, keys: validKeys }, "fr", prisma);
	assert.equal(upserts, 1, "an existing endpoint can update at the cap");
	await assert.rejects(
		registerEventPushSubscription("event", { endpoint: `${endpoint}-new`, keys: validKeys }, "en", prisma),
		{ name: "Error", message: "This event has reached its reminder limit" },
	);
	assert.equal(upserts, 1);
	assert.ok(new PushSubscriptionLimitError() instanceof Error);
});

const browserStorage = (t: TestContext) => {
	let stored = JSON.stringify(["event-1", "event-2"]);
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			localStorage: {
				getItem: () => stored,
				setItem: (_key: string, value: string) => {
					stored = value;
				},
			},
		},
	});
	t.after(() => {
		if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
		else Reflect.deleteProperty(globalThis, "window");
	});
};

void test("failed disable preserves both event requests and confirmed disable removes only its event", async t => {
	browserStorage(t);
	const fetchMock = t.mock.method(globalThis, "fetch", () =>
		Promise.resolve(Response.json({ error: "retry" }, { status: 503 })),
	);
	await assert.rejects(
		updateEventNotification(
			"event-1",
			false,
			{
				endpoint: "https://fcm.googleapis.com/token",
				expirationTime: null,
				keys: validKeys,
			},
			vapid.publicKey,
			"en",
		),
	);
	assert.deepEqual(JSON.parse(String(fetchMock.mock.calls[0]?.arguments[1]?.body)), {
		eventId: "event-1",
		enabled: false,
		subscription: { endpoint: "https://fcm.googleapis.com/token" },
	});
	assert.deepEqual(getRequestedEventNotifications(), ["event-1", "event-2"]);
	fetchMock.mock.mockImplementation(() => Promise.reject(new Error("offline")));
	await assert.rejects(updateEventNotification("event-1", false, {}, vapid.publicKey, "en"));
	assert.deepEqual(getRequestedEventNotifications(), ["event-1", "event-2"]);
	fetchMock.mock.mockImplementation(() => Promise.resolve(Response.json({ success: true })));
	await updateEventNotification(
		"event-1",
		false,
		{ endpoint: "https://fcm.googleapis.com/token" },
		vapid.publicKey,
		"en",
	);
	assert.deepEqual(getRequestedEventNotifications(), ["event-2"]);
});

void test("failed enable never promises a reminder; browser readiness requires matching server public key", async t => {
	browserStorage(t);
	const fetchMock = t.mock.method(globalThis, "fetch", () => Promise.resolve(Response.json({ success: false })));
	await assert.rejects(
		updateEventNotification(
			"new-event",
			true,
			{
				endpoint: "https://fcm.googleapis.com/token",
				expirationTime: null,
				keys: validKeys,
			},
			vapid.publicKey,
			"fr",
		),
	);
	const sentBody: unknown = JSON.parse(String(fetchMock.mock.calls[0]?.arguments[1]?.body));
	assert.deepEqual(sentBody, {
		eventId: "new-event",
		enabled: true,
		subscription: { endpoint: "https://fcm.googleapis.com/token", keys: validKeys },
		publicKey: vapid.publicKey,
		locale: "fr",
	});
	assert.deepEqual(getRequestedEventNotifications(), ["event-1", "event-2"]);
	fetchMock.mock.mockImplementation(() => Promise.resolve(Response.json({ available: true, publicKey: "wrong" })));
	assert.equal(await isPushServerAvailable(vapid.publicKey), false);
	fetchMock.mock.mockImplementation(() =>
		Promise.resolve(Response.json({ available: true, publicKey: vapid.publicKey })),
	);
	assert.equal(await isPushServerAvailable(vapid.publicKey), true);
});

void test("stored requests require granted permission and an existing browser subscription", async t => {
	browserStorage(t);
	const notification = Object.getOwnPropertyDescriptor(globalThis, "Notification");
	const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
	const mockNotification = { permission: "default" };
	Object.defineProperty(globalThis, "Notification", { configurable: true, value: mockNotification });
	Object.defineProperty(window, "Notification", { value: mockNotification });
	let subscription: object | null = {};
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			serviceWorker: {
				getRegistration: () =>
					Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(subscription) } }),
			},
		},
	});
	t.after(() => {
		if (notification) Object.defineProperty(globalThis, "Notification", notification);
		else Reflect.deleteProperty(globalThis, "Notification");
		if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
		else Reflect.deleteProperty(globalThis, "navigator");
	});
	assert.equal(await isEventNotificationRequested("event-1"), false);
	mockNotification.permission = "granted";
	assert.equal(await isEventNotificationRequested("event-1"), true);
	subscription = null;
	assert.equal(await isEventNotificationRequested("event-1"), false);
});

// Optional real-MySQL regression suite. Never inherits the application's DATABASE_URL.
const testDatabase = process.env.PUSH_TEST_DATABASE_URL;
void test("MySQL reminder claims and recovery", { skip: !testDatabase }, async t => {
	assert.ok(testDatabase);
	const url = new URL(testDatabase);
	assert.ok(
		["localhost", "127.0.0.1"].includes(url.hostname) && /test|review/.test(url.pathname),
		"Use an isolated local test database",
	);
	enablePush(t);
	const prisma = new PrismaClient({ datasourceUrl: testDatabase });
	t.after(() => prisma.$disconnect());
	const fixture = async (context: TestContext, count = 1) => {
		const id = `push-test-${randomUUID()}`;
		await prisma.event.create({
			data: {
				id,
				name: "Test reminder",
				nameFr: "Test",
				start: new Date(Date.now() + 60_000),
				end: new Date(),
				description: "",
				descriptionFr: "",
				room: "",
			},
		});
		context.after(async () => {
			await prisma.pushSubscription.deleteMany({ where: { eventId: id } });
			await prisma.event.delete({ where: { id } });
		});
		for (let i = 0; i < count; i++)
			await registerEventPushSubscription(
				id,
				{ endpoint: `https://fcm.googleapis.com/${id}/${i}`, keys: validKeys },
				"en",
				prisma,
			);
		await prisma.event.update({ where: { id }, data: { start: new Date(Date.now() - 60_000) } });
		return id;
	};

	await t.test("registration rejects due events and concurrent requests retain one subscription", async context => {
		const id = await fixture(context);
		const subscription = {
			endpoint: `https://fcm.googleapis.com/${id}/concurrent`,
			keys: validKeys,
		};
		await assert.rejects(
			registerEventPushSubscription(id, subscription, "en", prisma),
			PushRegistrationClosedError,
		);
		await prisma.event.update({ where: { id }, data: { start: new Date(Date.now() + 60_000) } });
		await Promise.all(
			Array.from({ length: 5 }, () => registerEventPushSubscription(id, subscription, "en", prisma)),
		);
		assert.equal(
			await prisma.pushSubscription.count({ where: { eventId: id, endpoint: subscription.endpoint } }),
			1,
		);
	});

	await t.test("the locked cap admits one final new endpoint and still permits updates", async context => {
		const id = await fixture(context);
		await prisma.event.update({ where: { id }, data: { start: new Date(Date.now() + 60_000) } });
		await prisma.pushSubscription.createMany({
			data: Array.from({ length: 4_998 }, (_, index) => ({
				id: randomUUID(),
				eventId: id,
				endpoint: `https://fcm.googleapis.com/${id}/cap-${index}`,
				...validKeys,
				locale: "en",
			})),
		});
		const attempts = await Promise.allSettled(
			["first", "second"].map(suffix =>
				registerEventPushSubscription(
					id,
					{ endpoint: `https://fcm.googleapis.com/${id}/${suffix}`, keys: validKeys },
					"en",
					prisma,
				),
			),
		);
		assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
		assert.ok(
			attempts.some(
				result => result.status === "rejected" && result.reason instanceof PushSubscriptionLimitError,
			),
		);
		assert.equal(await prisma.pushSubscription.count({ where: { eventId: id } }), 5_000);
		await registerEventPushSubscription(
			id,
			{ endpoint: `https://fcm.googleapis.com/${id}/0`, keys: validKeys },
			"fr",
			prisma,
		);
		assert.equal(
			(
				await prisma.pushSubscription.findUniqueOrThrow({
					where: { eventId_endpoint: { eventId: id, endpoint: `https://fcm.googleapis.com/${id}/0` } },
				})
			).locale,
			"fr",
		);
	});

	await t.test("concurrent workers deliver each subscriber only once", async context => {
		const id = await fixture(context);
		const started = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		let sends = 0;
		const send = async () => {
			sends++;
			started.resolve();
			await release.promise;
			return 201;
		};
		const first = sendDueEventNotifications(prisma, send);
		await started.promise;
		assert.equal(await sendDueEventNotifications(prisma, send), 0);
		release.resolve();
		assert.equal(await first, 1);
		assert.equal(sends, 1);
		assert.ok((await prisma.event.findUniqueOrThrow({ where: { id } })).notifiedAt);
	});

	await t.test("rescheduling settles the active batch without sending pending subscribers twice", async context => {
		const id = await fixture(context, 11);
		const batchStarted = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const sent: string[] = [];
		const first = sendDueEventNotifications(prisma, async subscription => {
			sent.push(subscription.endpoint);
			if (sent.length === 10) batchStarted.resolve();
			await release.promise;
			return 201;
		});
		await batchStarted.promise;
		await prisma.event.update({
			where: { id },
			data: { start: new Date(Date.now() + 60_000), notifiedAt: null },
		});
		release.resolve();
		assert.equal(await first, 0);
		assert.equal(sent.length, 10);
		assert.equal(await prisma.pushSubscription.count({ where: { eventId: id } }), 1);
		const rescheduled = await prisma.event.findUniqueOrThrow({ where: { id } });
		assert.equal(rescheduled.notifiedAt, null);
		assert.equal(rescheduled.notificationLeaseToken, null);
		assert.equal(rescheduled.notificationLeaseUntil, null);

		await prisma.event.update({ where: { id }, data: { start: new Date(Date.now() - 60_000) } });
		assert.equal(
			await sendDueEventNotifications(prisma, subscription => {
				sent.push(subscription.endpoint);
				return Promise.resolve(201);
			}),
			1,
		);
		assert.equal(sent.length, 11);
		assert.equal(new Set(sent).size, 11);
		assert.ok((await prisma.event.findUniqueOrThrow({ where: { id } })).notifiedAt);
	});

	await t.test("temporary failure retries only pending subscribers", async context => {
		const id = await fixture(context, 2);
		const sent: string[] = [];
		assert.equal(
			await sendDueEventNotifications(prisma, subscription => {
				sent.push(subscription.endpoint);
				return Promise.resolve(subscription.endpoint.endsWith("/0") ? 201 : 503);
			}),
			0,
		);
		assert.equal(await prisma.pushSubscription.count({ where: { eventId: id } }), 1);
		assert.equal(
			await sendDueEventNotifications(prisma, subscription => {
				sent.push(subscription.endpoint);
				return Promise.resolve(201);
			}),
			1,
		);
		assert.equal(sent.length, 3);
		assert.equal(sent.filter(endpoint => endpoint.endsWith("/0")).length, 1);
	});

	await t.test("payloads use each subscription's locale and locale-specific URL", async context => {
		const id = await fixture(context, 2);
		await prisma.pushSubscription.updateMany({ where: { eventId: id }, data: { locale: "fr" } });
		await prisma.pushSubscription.updateMany({
			where: { eventId: id, endpoint: { endsWith: "/0" } },
			data: { locale: "en" },
		});
		const payloads: Array<Record<string, unknown>> = [];
		assert.equal(
			await sendDueEventNotifications(prisma, (_subscription, payload) => {
				payloads.push(JSON.parse(payload) as Record<string, unknown>);
				return Promise.resolve(201);
			}),
			1,
		);
		assert.ok(
			payloads.some(
				payload =>
					payload.title === "Test reminder" &&
					payload.body === "This event has started." &&
					(payload.data as { url: string }).url === `/schedule/event?id=${id}`,
			),
		);
		assert.ok(
			payloads.some(
				payload =>
					payload.title === "Test" &&
					payload.body === "Cet événement a commencé." &&
					(payload.data as { url: string }).url === `/fr/schedule/event?id=${id}`,
			),
		);
	});

	await t.test(
		"expired leases recover, and stale owners cannot delete or complete a new owner's work",
		async context => {
			const id = await fixture(context);
			await prisma.event.update({
				where: { id },
				data: { notificationLeaseToken: "crashed", notificationLeaseUntil: new Date(Date.now() - 1_000) },
			});
			let sends = 0;
			assert.equal(
				await sendDueEventNotifications(prisma, async () => {
					sends++;
					await prisma.event.update({
						where: { id },
						data: {
							notificationLeaseToken: "replacement",
							notificationLeaseUntil: new Date(Date.now() + 120_000),
						},
					});
					return 201;
				}),
				0,
			);
			assert.equal(sends, 1);
			assert.equal(await prisma.pushSubscription.count({ where: { eventId: id } }), 1);
			assert.equal(
				(await prisma.event.findUniqueOrThrow({ where: { id } })).notificationLeaseToken,
				"replacement",
			);
			await prisma.event.update({
				where: { id },
				data: { notificationLeaseUntil: new Date(Date.now() - 1_000) },
			});
			assert.equal(await sendDueEventNotifications(prisma, () => Promise.resolve(201)), 1);
		},
	);

	await t.test("large healthy events drain multiple bounded batches in one tick", async context => {
		await fixture(context, 25);
		let active = 0;
		let maximum = 0;
		let sent = 0;
		assert.equal(
			await sendDueEventNotifications(prisma, async () => {
				active++;
				maximum = Math.max(maximum, active);
				await new Promise(resolve => setImmediate(resolve));
				active--;
				sent++;
				return 201;
			}),
			1,
		);
		assert.equal(sent, 25);
		assert.ok(maximum <= 10);
	});

	await t.test(
		"default transport signs/encrypts pushes, rejects redirects and cancels response bodies",
		async context => {
			const id = await fixture(context);
			const key = createECDH("prime256v1");
			await prisma.pushSubscription.updateMany({
				where: { eventId: id },
				data: { p256dh: key.generateKeys().toString("base64url"), auth: randomBytes(16).toString("base64url") },
			});
			let cancelled = false;
			let status = 503;
			const transport = context.mock.method(
				globalThis,
				"fetch",
				(endpoint: string | URL | Request, options?: RequestInit) => {
					assert.match(String(endpoint), /^https:\/\/fcm\.googleapis\.com\//);
					assert.equal(options?.redirect, "error");
					assert.ok(options?.signal instanceof AbortSignal);
					assert.ok(options?.body instanceof Uint8Array);
					const headers = new Headers(options?.headers);
					assert.match(headers.get("Authorization") ?? "", /^vapid /);
					assert.equal(headers.get("Content-Encoding"), "aes128gcm");
					return Promise.resolve(
						new Response(
							new ReadableStream({
								cancel() {
									cancelled = true;
								},
							}),
							{ status },
						),
					);
				},
			);
			assert.equal(await sendDueEventNotifications(prisma), 0);
			assert.equal(await prisma.pushSubscription.count({ where: { eventId: id } }), 1);
			assert.equal(cancelled, true);
			status = 201;
			assert.equal(await sendDueEventNotifications(prisma), 1);
			assert.equal(transport.mock.callCount(), 2);
		},
	);

	await t.test("a slow event yields at its shared deadline so other events can deliver", async context => {
		await fixture(context, 12);
		await fixture(context);
		const controllers: AbortController[] = [];
		context.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
			assert.equal(milliseconds, 30_000);
			const controller = new AbortController();
			controllers.push(controller);
			return controller.signal;
		});
		let slowSignal: AbortSignal | undefined;
		let delivered = 0;
		await sendDueEventNotifications(prisma, (_subscription, _payload, signal) => {
			if (!slowSignal) {
				slowSignal = signal;
				setImmediate(() => controllers[0]?.abort());
			}
			if (signal === slowSignal)
				return new Promise((_resolve, reject) =>
					signal.addEventListener("abort", () => reject(new Error("deadline")), { once: true }),
				);
			delivered++;
			return Promise.resolve(201);
		});
		assert.equal(controllers.length, 2);
		assert.ok(delivered > 0);
	});

	await t.test(
		"404/410, unsafe endpoints, and malformed stored keys are pruned without unsafe delivery",
		async context => {
			const id = await fixture(context, 4);
			await prisma.pushSubscription.updateMany({
				where: { eventId: id, endpoint: { endsWith: "/2" } },
				data: { endpoint: "https://127.0.0.1/private" },
			});
			await prisma.pushSubscription.updateMany({
				where: { eventId: id, endpoint: { endsWith: "/3" } },
				data: { p256dh: "malformed", auth: "malformed" },
			});
			let sent = 0;
			assert.equal(
				await sendDueEventNotifications(prisma, subscription => {
					sent++;
					assert.ok(isAllowedPushEndpoint(subscription.endpoint));
					return Promise.resolve(subscription.endpoint.endsWith("/0") ? 404 : 410);
				}),
				1,
			);
			assert.equal(sent, 2);
		},
	);

	await t.test(
		"subscriptions are unique, case-sensitive and disabling one event leaves another intact",
		async context => {
			const id = await fixture(context);
			const other = await fixture(context);
			await prisma.event.update({ where: { id }, data: { start: new Date(Date.now() + 60_000) } });
			const endpoint = `https://fcm.googleapis.com/${id}/Token`;
			await registerEventPushSubscription(id, { endpoint, keys: validKeys }, "en", prisma);
			const replacementKeys = {
				p256dh: createECDH("prime256v1").generateKeys().toString("base64url"),
				auth: randomBytes(16).toString("base64url"),
			};
			await registerEventPushSubscription(id, { endpoint, keys: replacementKeys }, "fr", prisma);
			await registerEventPushSubscription(
				id,
				{ endpoint: endpoint.replace("Token", "token"), keys: validKeys },
				"en",
				prisma,
			);
			assert.equal(await prisma.pushSubscription.count({ where: { eventId: id } }), 3);
			assert.deepEqual(
				await prisma.pushSubscription.findUniqueOrThrow({
					where: { eventId_endpoint: { eventId: id, endpoint } },
					select: { p256dh: true, auth: true, locale: true },
				}),
				{ ...replacementKeys, locale: "fr" },
			);
			await unregisterEventPushSubscription(id, endpoint, prisma);
			assert.equal(await prisma.pushSubscription.count({ where: { eventId: id } }), 2);
			assert.equal(await prisma.pushSubscription.count({ where: { eventId: other } }), 1);
		},
	);
});
