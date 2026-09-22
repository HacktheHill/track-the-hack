const STORAGE_KEY = "track-the-hack:event-notification-requests";

export const getRequestedEventNotifications = (): string[] => {
	try {
		const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
	} catch {
		return [];
	}
};

export const isEventNotificationRequested = async (eventId: string): Promise<boolean> => {
	if (
		typeof window === "undefined" ||
		!("Notification" in window) ||
		Notification.permission !== "granted" ||
		!("serviceWorker" in navigator) ||
		!getRequestedEventNotifications().includes(eventId)
	)
		return false;
	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		return !!(await registration?.pushManager.getSubscription());
	} catch {
		return false;
	}
};

export const isPushServerAvailable = async (publicKey: string): Promise<boolean> => {
	try {
		const response = await fetch("/api/push/register", { cache: "no-store" });
		const status: unknown = await response.json();
		return (
			response.ok &&
			typeof status === "object" &&
			status !== null &&
			"available" in status &&
			status.available === true &&
			"publicKey" in status &&
			status.publicKey === publicKey
		);
	} catch {
		return false;
	}
};

// Only record a change after the server confirms it; a failed disable must leave
// this and every other event's reminder active so the attendee can retry.
export const updateEventNotification = async (
	eventId: string,
	enabled: boolean,
	subscription: PushSubscriptionJSON,
	publicKey: string,
	locale: "en" | "fr",
) => {
	const response = await fetch("/api/push/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(
			enabled ? { eventId, enabled, subscription, publicKey, locale } : { eventId, enabled, subscription },
		),
	});
	const result: unknown = await response.json();
	if (
		!response.ok ||
		typeof result !== "object" ||
		result === null ||
		!("success" in result) ||
		result.success !== true
	) {
		throw new Error("Unable to update notifications. Please try again.");
	}
	const requested = getRequestedEventNotifications().filter(id => id !== eventId);
	if (enabled) requested.push(eventId);
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requested));
	} catch {
		// The server accepted the update even when browser storage is unavailable.
	}
};
