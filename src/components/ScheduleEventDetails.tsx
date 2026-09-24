import { EventType } from "@prisma/client";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { env } from "@/env/client.mjs";
import { trpc } from "@/server/api/api";
import { formatScheduleDate, formatScheduleTime, scheduleDayKey } from "@/utils/schedule-time";
import {
	isEventNotificationRequested,
	isPushServerAvailable,
	updateEventNotification,
} from "@/utils/event-notifications";
import { getEventRoom } from "@/utils/event-room";
import EventInterestButton from "./EventInterestButton";
import Error from "./Error";
import Loading from "./Loading";

const VAPID_PUBLIC_KEY = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const urlBase64ToUint8Array = (value: string) => {
	const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
	const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(binary, char => char.charCodeAt(0));
};

const isNotificationRequestLookupAvailable = () =>
	typeof window !== "undefined" &&
	"Notification" in window &&
	"serviceWorker" in navigator &&
	"PushManager" in window;

const isPushAvailable = () =>
	isNotificationRequestLookupAvailable() && !!VAPID_PUBLIC_KEY.trim() && Notification.permission !== "denied";

type Props = { id: string; onClose?: () => void };

export default function ScheduleEventDetails({ id, onClose }: Props) {
	const { t } = useTranslation("event");
	const router = useRouter();
	const locale = router.locale === "fr" ? "fr-CA" : "en-CA";
	// events.all is the deliberately public, hidden-filtered schedule payload.
	// Reusing it here means one successful schedule load contains the data for
	// every event detail, including when a participant later opens one offline.
	const query = trpc.events.all.useQuery(undefined, {
		enabled: !!id,
		networkMode: "offlineFirst",
		select: events => events.find(event => event.id === id),
	});
	const [pushAvailable, setPushAvailable] = useState(false);
	const [notifyRequested, setNotifyRequested] = useState(false);
	const [notifyPending, setNotifyPending] = useState(false);
	const [notifyError, setNotifyError] = useState(false);
	const pending = useRef(false);
	const event = query.data;
	const eventId = event?.id;
	const eventStartsAt = event?.start.getTime();
	const notifyLabel = !pushAvailable
		? notifyRequested
			? t("notify-me-cancel-unavailable")
			: t("notify-me-unavailable")
		: notifyRequested
			? t("notify-me-remove")
			: t("notify-me");

	useEffect(() => {
		let cancelled = false;
		setPushAvailable(false);
		setNotifyRequested(false);
		setNotifyError(false);
		if (eventId && eventStartsAt !== undefined && isNotificationRequestLookupAvailable()) {
			void isEventNotificationRequested(eventId).then(requested => {
				if (!cancelled) setNotifyRequested(requested);
			});
			if (eventStartsAt > Date.now() && VAPID_PUBLIC_KEY.trim()) {
				void isPushServerAvailable(VAPID_PUBLIC_KEY).then(available => {
					if (!cancelled) setPushAvailable(available);
				});
			}
		}
		return () => {
			cancelled = true;
		};
	}, [eventId, eventStartsAt]);

	const handleNotifyToggle = async () => {
		if (!event || pending.current || !isPushAvailable() || (!pushAvailable && !notifyRequested)) return;
		pending.current = true;
		setNotifyPending(true);
		setNotifyError(false);
		try {
			if (notifyRequested) {
				const registration = await navigator.serviceWorker.getRegistration("/");
				const subscription = await registration?.pushManager.getSubscription();
				if (!subscription) throw new globalThis.Error("Push subscription not found");
				await updateEventNotification(
					event.id,
					false,
					subscription.toJSON(),
					VAPID_PUBLIC_KEY,
					router.locale === "fr" ? "fr" : "en",
				);
				setNotifyRequested(false);
			} else {
				const permissionGranted =
					Notification.permission === "granted" || (await Notification.requestPermission()) === "granted";
				if (!permissionGranted) {
					if (Notification.permission === "denied") setPushAvailable(false);
					return;
				}
				await navigator.serviceWorker.register("/sw.js", { scope: "/" });
				const registration = await navigator.serviceWorker.ready;
				const subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
				});
				await updateEventNotification(
					event.id,
					true,
					subscription.toJSON(),
					VAPID_PUBLIC_KEY,
					router.locale === "fr" ? "fr" : "en",
				);
				setNotifyRequested(true);
			}
		} catch {
			setNotifyError(true);
		} finally {
			pending.current = false;
			setNotifyPending(false);
		}
	};

	return (
		<div className="relative flex w-full max-w-2xl flex-col items-center gap-6 px-4 pb-8 pt-16 text-center text-dark-color">
			<div className="absolute right-4 top-3 flex items-center gap-2">
				{event && <EventInterestButton eventId={event.id} />}
				{event && (
					<button
						type="button"
						onClick={() => void handleNotifyToggle()}
						disabled={notifyPending || (!pushAvailable && !notifyRequested)}
						aria-busy={notifyPending}
						aria-pressed={notifyRequested}
						aria-label={notifyLabel}
						title={notifyLabel}
						className={`ui-button ui-button-icon ${!pushAvailable && !notifyRequested ? "border-dark-color bg-light-primary-color text-dark-color opacity-70" : notifyRequested ? "border-dark-color bg-dark-color text-light-color" : "border-dark-color bg-light-primary-color text-dark-color hover:bg-dark-secondary-color"}`}
					>
						<svg
							viewBox="0 0 24 24"
							width="24"
							height="24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10Z" />
							<path d="M10 22h4" />
						</svg>
					</button>
				)}
				<button
					type="button"
					className="ui-button ui-button-icon"
					onClick={onClose ?? (() => void router.push("/schedule"))}
					aria-label={t("close-event")}
					autoFocus={Boolean(onClose)}
				>
					<svg
						viewBox="0 0 24 24"
						width="24"
						height="24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						aria-hidden="true"
					>
						<path d="M5 5 19 19M19 5 5 19" />
					</svg>
				</button>
			</div>
			{query.fetchStatus === "paused" && !event ? (
				<p className="font-rubik text-dark-color" role="status">
					{t("common:offline-schedule-unavailable")}
				</p>
			) : query.isError || (query.isSuccess && !event) ? (
				<Error message={t("common:temporarily-unavailable")} />
			) : !event ? (
				<Loading />
			) : (
				<>
					<div className="flex w-full flex-col items-center font-rubik">
						<h1 id="event-detail-title" className="ui-page-title">
							{router.locale === "fr" ? event.nameFr : event.name}
						</h1>
						<p className="text-lg">
							{formatScheduleDate(event.start, locale, {
								weekday: "long",
								month: "short",
								day: "numeric",
							})}{" "}
							{formatScheduleTime(event.start, locale)}
							{" – "}
							{scheduleDayKey(event.start) !== scheduleDayKey(event.end) && (
								<>
									{formatScheduleDate(event.end, locale, {
										weekday: "long",
										month: "short",
										day: "numeric",
									})}{" "}
								</>
							)}
							{formatScheduleTime(event.end, locale)}
						</p>
						<p className="text-lg">{getEventRoom(event, router.locale)}</p>
						{event.type !== EventType.ALL && <p>{t(`type.${event.type}`)}</p>}
						{event.host && <p className="text-sm">{event.host}</p>}
						<span className="sr-only" aria-live="polite">
							{notifyRequested ? t("notify-me-active") : ""}
						</span>
						{notifyError && (
							<p role="alert" className="mt-2 text-sm">
								{t("notify-me-error")}
							</p>
						)}
					</div>
					{event.image && (
						<Image
							src={event.image}
							width={350}
							height={325}
							alt={router.locale === "fr" ? event.nameFr : event.name}
						/>
					)}
					{event.link && (
						<Link href={event.link} target="_blank" rel="noreferrer" className="ui-button">
							{router.locale === "fr" ? event.linkTextFr : event.linkText}
						</Link>
					)}
					<div className="flex max-w-xl flex-col font-rubik">
						<p className="text-xl">
							{(router.locale === "fr" ? event.descriptionFr : event.description)
								.split(/\\n|\r?\n/)
								.map((line, index, lines) => (
									<span key={index}>
										{line}
										{index < lines.length - 1 && <br />}
									</span>
								))}
						</p>
					</div>
				</>
			)}
		</div>
	);
}
