import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { env } from "@/env/client.mjs";
import { trpc } from "@/server/api/api";

const decodeKey = (value: string) => {
	const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
	const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const serializeSubscription = (subscription: PushSubscription) => {
	const value = subscription.toJSON();
	const p256dh = value.keys?.p256dh;
	const auth = value.keys?.auth;
	if (!value.endpoint || !p256dh || !auth) throw new Error("Incomplete push subscription");
	return { endpoint: value.endpoint, keys: { p256dh, auth } };
};

export default function NotificationPreferences() {
	const { t, i18n } = useTranslation("profile");
	const query = trpc.notifications.preferences.useQuery();
	const discordMutation = trpc.notifications.setDiscordEnabled.useMutation({ onSuccess: () => void query.refetch() });
	const pushMutation = trpc.notifications.setPushEnabled.useMutation({ onSuccess: () => void query.refetch() });
	const [error, setError] = useState("");
	const associated = useRef(false);
	const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

	const associateExisting = async () => {
		if (
			associated.current ||
			!query.data?.pushAvailable ||
			query.data.pushSubscribed ||
			Notification.permission !== "granted"
		)
			return;
		associated.current = true;
		try {
			const registration = await navigator.serviceWorker.getRegistration("/");
			const subscription = await registration?.pushManager.getSubscription();
			if (subscription)
				await pushMutation.mutateAsync({
					enabled: true,
					subscription: serializeSubscription(subscription),
					locale: i18n.language === "fr" ? "fr" : "en",
				});
		} catch {
			associated.current = false;
		}
	};

	useEffect(() => {
		if (typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window)
			void associateExisting();
		// associateExisting intentionally follows the latest query result without retriggering on mutation identity changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query.data?.pushAvailable, query.data?.pushSubscribed]);

	const togglePush = async () => {
		setError("");
		try {
			if (query.data?.pushEnabled) {
				const registration = await navigator.serviceWorker.getRegistration("/");
				const subscription = await registration?.pushManager.getSubscription();
				await pushMutation.mutateAsync({ enabled: false });
				await subscription?.unsubscribe();
				return;
			}
			if (
				!("Notification" in window) ||
				!("serviceWorker" in navigator) ||
				!("PushManager" in window) ||
				!publicKey
			)
				throw new Error();
			const permission =
				Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
			if (permission !== "granted") throw new Error();
			await navigator.serviceWorker.register("/sw.js", { scope: "/" });
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: decodeKey(publicKey),
			});
			await pushMutation.mutateAsync({
				enabled: true,
				subscription: serializeSubscription(subscription),
				locale: i18n.language === "fr" ? "fr" : "en",
			});
		} catch {
			setError(t("notifications.update-error"));
		}
	};

	if (query.isLoading) return <p className="mt-4 font-rubik text-dark-color">{t("notifications.loading")}</p>;
	if (query.isError || !query.data)
		return (
			<p role="alert" className="mt-4 font-rubik text-dark-color">
				{t("notifications.unavailable")}
			</p>
		);
	const pushSupported =
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator &&
		"PushManager" in window;
	const pushUnavailable = !query.data.pushAvailable || !pushSupported || Notification.permission === "denied";

	return (
		<div className="mt-4 grid gap-5 font-rubik text-dark-color">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-bold">{t("notifications.discord")}</h3>
					<p className="text-sm">
						{query.data.discordLinked === null
							? t("notifications.status-unavailable")
							: query.data.discordLinked
								? t("notifications.discord-linked")
								: t("notifications.discord-unlinked")}
					</p>
				</div>
				<button
					type="button"
					className="ui-button"
					aria-pressed={query.data.discordEnabled}
					disabled={query.data.discordLinked !== true || discordMutation.isLoading}
					onClick={() =>
						void discordMutation
							.mutateAsync({ enabled: !query.data.discordEnabled })
							.catch(() => setError(t("notifications.update-error")))
					}
				>
					{query.data.discordEnabled ? t("notifications.disable") : t("notifications.enable")}
				</button>
			</div>
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-bold">{t("notifications.push")}</h3>
					<p className="text-sm">
						{pushUnavailable
							? t("notifications.push-unavailable")
							: query.data.pushEnabled
								? t("notifications.push-enabled")
								: t("notifications.push-disabled")}
					</p>
				</div>
				<button
					type="button"
					className="ui-button"
					aria-pressed={query.data.pushEnabled}
					disabled={pushMutation.isLoading || (pushUnavailable && !query.data.pushEnabled)}
					onClick={() => void togglePush()}
				>
					{query.data.pushEnabled ? t("notifications.disable") : t("notifications.enable")}
				</button>
			</div>
			{error && (
				<p role="alert" className="text-sm">
					{error}
				</p>
			)}
		</div>
	);
}
