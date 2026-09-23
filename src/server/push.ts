import { createECDH, ECDH, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import webPush from "web-push";
import { z } from "zod";

export type PushSubscriptionPayload = {
	endpoint: string;
	keys: { p256dh: string; auth: string };
};

export type PushLocale = "en" | "fr";

const MAX_EVENT_SUBSCRIPTIONS = 5_000;
const P256DH_ENCODED_LENGTH = 87;
const AUTH_ENCODED_LENGTH = 22;

const ALLOWED_PUSH_DOMAINS = [
	/(^|\.)push\.apple\.com$/i,
	/(^|\.)push\.services\.mozilla\.com$/i,
	/(^|\.)fcm\.googleapis\.com$/i,
	/(^|\.)android\.googleapis\.com$/i,
	/(^|\.)notify\.windows\.com$/i,
	/(^|\.)wns\.windows\.com$/i,
];

export const isAllowedPushEndpoint = (endpoint: string): boolean => {
	if (endpoint.length > 512) return false;
	try {
		const url = new URL(endpoint);
		return (
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			(!url.port || url.port === "443") &&
			!url.hostname.includes("..") &&
			ALLOWED_PUSH_DOMAINS.some(pattern => pattern.test(url.hostname))
		);
	} catch {
		return false;
	}
};

const decodeCanonicalBase64Url = (value: string, encodedLength: number) => {
	if (value.length !== encodedLength || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
	const decoded = Buffer.from(value, "base64url");
	return decoded.toString("base64url") === value ? decoded : null;
};

export const hasValidPushKeys = ({ p256dh, auth }: PushSubscriptionPayload["keys"]): boolean => {
	const publicKey = decodeCanonicalBase64Url(p256dh, P256DH_ENCODED_LENGTH);
	const authSecret = decodeCanonicalBase64Url(auth, AUTH_ENCODED_LENGTH);
	if (publicKey?.length !== 65 || publicKey[0] !== 0x04 || authSecret?.length !== 16) return false;
	try {
		ECDH.convertKey(publicKey, "prime256v1");
		return true;
	} catch {
		return false;
	}
};

export const isValidPushSubscription = (subscription: PushSubscriptionPayload): boolean =>
	isAllowedPushEndpoint(subscription.endpoint) && hasValidPushKeys(subscription.keys);

// The public key embedded in the browser must match the private signing key.
// Invalid or incomplete optional configuration disables push without disabling the app.
export const getPushConfiguration = (
	configuration = {
		publicKey: process.env.VAPID_PUBLIC_KEY,
		privateKey: process.env.VAPID_PRIVATE_KEY,
		clientPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
		email: process.env.VAPID_EMAIL,
	},
) => {
	const { publicKey, privateKey, clientPublicKey } = configuration;
	const email = configuration.email || "hello@hackthehill.com";
	if (!publicKey || !privateKey || publicKey !== clientPublicKey || !z.string().email().safeParse(email).success) {
		return null;
	}
	try {
		const key = Buffer.from(privateKey, "base64url");
		if (key.length !== 32 || key.toString("base64url") !== privateKey) return null;
		const ecdh = createECDH("prime256v1");
		ecdh.setPrivateKey(key);
		if (ecdh.getPublicKey().toString("base64url") !== publicKey) return null;
		return { publicKey, privateKey, subject: `mailto:${email}` };
	} catch {
		return null;
	}
};

const getPrismaClient = async () => (await import("@/server/db")).prisma;

let reminderScheduler: NodeJS.Timeout | undefined;
export const startEventReminderScheduler = () => {
	if (reminderScheduler) return reminderScheduler;
	let running = false;
	const tick = async () => {
		if (running || !getPushConfiguration()) return;
		running = true;
		try {
			await sendDueEventNotifications();
		} catch {
			// Do not log endpoint capabilities, keys, or push-service response bodies.
			console.error("Event reminder delivery failed; pending reminders will be retried.");
		} finally {
			running = false;
		}
	};
	reminderScheduler = setInterval(() => void tick(), 60_000);
	reminderScheduler.unref();
	void tick();
	return reminderScheduler;
};

export class PushRegistrationClosedError extends Error {}
export class PushSubscriptionLimitError extends Error {}

export const registerEventPushSubscription = async (
	eventId: string,
	subscription: PushSubscriptionPayload,
	locale: PushLocale,
	prismaClient?: PrismaClient,
) => {
	if (!eventId || eventId.length > 191 || !isValidPushSubscription(subscription) || !["en", "fr"].includes(locale)) {
		throw new Error("Invalid push subscription");
	}
	const client = prismaClient ?? (await getPrismaClient());
	const data = { eventId, endpoint: subscription.endpoint, ...subscription.keys, locale };
	await client.$transaction(async transaction => {
		// Serialize registration with the scheduler's atomic event claim. An
		// accepted subscription must be visible before the event can complete.
		const events = await transaction.$queryRaw<Array<{ id: string }>>`
			SELECT id FROM Event WHERE id = ${eventId}
			AND hidden = 0 AND start > UTC_TIMESTAMP(3) AND notifiedAt IS NULL FOR UPDATE
		`;
		if (!events.length) throw new PushRegistrationClosedError("This event is no longer accepting reminders");
		const existing = await transaction.pushSubscription.findUnique({
			where: { eventId_endpoint: { eventId, endpoint: subscription.endpoint } },
			select: { id: true },
		});
		if (
			!existing &&
			(await transaction.pushSubscription.count({ where: { eventId } })) >= MAX_EVENT_SUBSCRIPTIONS
		) {
			throw new PushSubscriptionLimitError("This event has reached its reminder limit");
		}
		await transaction.pushSubscription.upsert({
			where: { eventId_endpoint: { eventId, endpoint: subscription.endpoint } },
			create: data,
			update: { ...subscription.keys, locale },
		});
	});
};

export const unregisterEventPushSubscription = async (
	eventId: string,
	endpoint: string,
	prismaClient?: PrismaClient,
) => {
	if (!endpoint) return;
	const client = prismaClient ?? (await getPrismaClient());
	await client.pushSubscription.deleteMany({ where: { eventId, endpoint } });
};

// A total request deadline (including DNS/connect/response) stays well below the
// two-minute lease. web-push's own timeout only limits socket inactivity.
const sendPushNotification = async (subscription: PushSubscriptionPayload, payload: string, signal: AbortSignal) => {
	const configuration = getPushConfiguration();
	if (!configuration) throw new Error("Push notifications unavailable");
	const request = webPush.generateRequestDetails(subscription, payload, { vapidDetails: configuration });
	const response = await fetch(request.endpoint, {
		method: request.method,
		headers: request.headers,
		body: request.body ? new Uint8Array(request.body) : undefined,
		signal,
		redirect: "error",
	});
	await response.body?.cancel();
	return response.status;
};

// All lease times come from MySQL, so instances with different clocks agree.
// A fresh random token fences writes from a worker whose lease has expired.
const renewLease = async (client: PrismaClient, eventId: string, token: string) => {
	return (
		(await client.$executeRaw`
		UPDATE Event SET notificationLeaseUntil = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 2 MINUTE)
		WHERE id = ${eventId} AND notificationLeaseToken = ${token}
		AND notificationLeaseUntil > UTC_TIMESTAMP(3) AND notifiedAt IS NULL
		AND hidden = 0 AND start <= UTC_TIMESTAMP(3)
	`) === 1
	);
};

export const sendDueEventNotifications = async (
	prismaClient?: PrismaClient,
	sendNotification = sendPushNotification,
) => {
	// Never mark reminders complete while sending is unavailable.
	if (!getPushConfiguration()) return 0;
	const client = prismaClient ?? (await getPrismaClient());
	const dueEvents = await client.event.findMany({
		where: { hidden: false, start: { lte: new Date() }, notifiedAt: null },
		select: { id: true, name: true, nameFr: true },
	});
	let notified = 0;
	for (const event of dueEvents) {
		const token = randomUUID();
		const claimed = await client.$executeRaw`
			UPDATE Event SET notificationLeaseToken = ${token},
				notificationLeaseUntil = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 2 MINUTE)
			WHERE id = ${event.id} AND hidden = 0 AND notifiedAt IS NULL AND start <= UTC_TIMESTAMP(3)
			AND (notificationLeaseUntil IS NULL OR notificationLeaseUntil <= UTC_TIMESTAMP(3))
		`;
		if (claimed !== 1) continue;
		try {
			// Fast providers can drain many batches; a slow event yields after 30s.
			const deadline = AbortSignal.timeout(30_000);
			const failedIds: string[] = [];
			while (!deadline.aborted) {
				const subscriptions = await client.pushSubscription.findMany({
					where: { eventId: event.id, id: { notIn: failedIds } },
					orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
					take: 10,
				});
				if (!subscriptions.length || !(await renewLease(client, event.id, token)) || deadline.aborted) break;
				// Wait for all writes before releasing ownership, including on DB failure.
				const results = await Promise.allSettled(
					subscriptions.map(async subscription => {
						let status = 503;
						try {
							const storedSubscription = {
								endpoint: subscription.endpoint,
								keys: { p256dh: subscription.p256dh, auth: subscription.auth },
							};
							status = isValidPushSubscription(storedSubscription)
								? await sendNotification(
										storedSubscription,
										JSON.stringify({
											title: subscription.locale === "fr" ? event.nameFr : event.name,
											body:
												subscription.locale === "fr"
													? "Cet événement a commencé."
													: "This event has started.",
											tag: `event-${event.id}`,
											icon: "/icons/android-chrome-192x192.png",
											data: {
												url: `${subscription.locale === "fr" ? "/fr" : ""}/schedule/event?id=${encodeURIComponent(event.id)}`,
											},
										}),
										deadline,
									)
								: 410;
						} catch {
							// Network failures remain pending for retry.
						}
						if ((status >= 200 && status < 300) || status === 404 || status === 410) {
							await client.$executeRaw`
							DELETE subscription FROM PushSubscription AS subscription
							INNER JOIN Event AS event ON event.id = subscription.eventId
							WHERE subscription.id = ${subscription.id} AND event.notificationLeaseToken = ${token}
							AND event.notificationLeaseUntil > UTC_TIMESTAMP(3)
						`;
						} else {
							failedIds.push(subscription.id);
							// Rotate failures behind other pending attendees on the next tick.
							await client.$executeRaw`
							UPDATE PushSubscription AS subscription
							INNER JOIN Event AS event ON event.id = subscription.eventId
							SET subscription.updatedAt = UTC_TIMESTAMP(3)
							WHERE subscription.id = ${subscription.id} AND event.notificationLeaseToken = ${token}
							AND event.notificationLeaseUntil > UTC_TIMESTAMP(3)
						`;
						}
					}),
				);
				if (results.some(result => result.status === "rejected")) {
					throw new Error("Failed to persist event notification results");
				}
			}
			notified += await client.$executeRaw`
				UPDATE Event SET notifiedAt = UTC_TIMESTAMP(3)
				WHERE id = ${event.id} AND notificationLeaseToken = ${token}
				AND notificationLeaseUntil > UTC_TIMESTAMP(3) AND notifiedAt IS NULL
				AND hidden = 0 AND start <= UTC_TIMESTAMP(3)
				AND NOT EXISTS (SELECT 1 FROM PushSubscription WHERE eventId = ${event.id})
			`;
		} finally {
			await client.event.updateMany({
				where: { id: event.id, notificationLeaseToken: token },
				data: { notificationLeaseToken: null, notificationLeaseUntil: null },
			});
		}
	}
	return notified;
};
