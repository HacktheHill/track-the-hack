import { EventType } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import EventInterestButton from "@/components/EventInterestButton";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import { env } from "@/env/client.mjs";
import { trpc, type RouterOutputs } from "@/server/api/api";
import {
	isEventNotificationRequested,
	isPushServerAvailable,
	updateEventNotification,
} from "@/utils/event-notifications";

const VAPID_PUBLIC_KEY = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const urlBase64ToUint8Array = (value: string) => {
	const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
	const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(normalized);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
};

const isPushAvailable = () => {
	if (typeof window === "undefined") {
		return false;
	}

	if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
		return false;
	}

	if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.trim() === "") {
		return false;
	}

	if (Notification.permission === "denied") {
		return false;
	}

	return true;
};

const requestEventNotificationPermission = async () => {
	if (typeof window === "undefined" || !("Notification" in window)) {
		return false;
	}

	if (Notification.permission === "granted") {
		return true;
	}

	if (Notification.permission === "denied") {
		return false;
	}

	return (await Notification.requestPermission()) === "granted";
};

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "event"]),
	};
};

const EventPage: NextPage = () => {
	const { t } = useTranslation("event");
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const query = trpc.events.get.useQuery({ id: id ?? "" }, { enabled: !!id });

	const types = {
		[EventType.ALL]: t("type.ALL"),
		[EventType.GENERAL]: t("type.GENERAL"),
		[EventType.COMPETITION]: t("type.COMPETITION"),
		[EventType.CAREER_FAIR]: t("type.CAREER_FAIR"),
		[EventType.FOOD]: t("type.FOOD"),
		[EventType.SOCIAL]: t("type.SOCIAL"),
		[EventType.WORKSHOP]: t("type.WORKSHOP"),
	};

	return (
		<App
			className="relative flex h-full w-full flex-col items-center justify-start gap-8 overflow-y-auto bg-default-gradient px-4 pb-8 pt-20 text-center"
			title={t("title")}
			integrated={true}
		>
			{query.isError ? (
				<Error message={t("common:temporarily-unavailable")} />
			) : query.data === null || query.isLoading ? (
				<Loading />
			) : (
				<EventView key={query.data.id} event={query.data} types={types} />
			)}
		</App>
	);
};

type EventViewProps = {
	event: RouterOutputs["events"]["get"];
	types: Record<EventType, string>;
};

const EventView = ({ event, types }: EventViewProps) => {
	const { t } = useTranslation("event");
	const router = useRouter();
	const { locale } = router;
	const [pushAvailable, setPushAvailable] = useState(false);
	const [notifyRequested, setNotifyRequested] = useState(false);

	const [notifyPending, setNotifyPending] = useState(false);
	const [notifyError, setNotifyError] = useState(false);
	const pending = useRef(false);

	useEffect(() => {
		let cancelled = false;
		setPushAvailable(false);
		setNotifyRequested(false);
		if (isPushAvailable()) {
			void isEventNotificationRequested(event.id).then(requested => {
				if (!cancelled) setNotifyRequested(requested);
			});
		}
		setNotifyError(false);
		if (isPushAvailable() && event.start > new Date()) {
			void isPushServerAvailable(VAPID_PUBLIC_KEY).then(available => {
				if (!cancelled) setPushAvailable(available);
			});
		}
		return () => {
			cancelled = true;
		};
	}, [event.id, event.start]);

	const handleNotifyToggle = async () => {
		if (pending.current || !isPushAvailable() || (!pushAvailable && !notifyRequested)) return;
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
					locale === "fr" ? "fr" : "en",
				);
				setNotifyRequested(false);
			} else {
				const permissionGranted = await requestEventNotificationPermission();
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
					locale === "fr" ? "fr" : "en",
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

	const {
		name,
		nameFr,
		start,
		end,
		room,
		type,
		host,
		description,
		descriptionFr,
		image,
		link,
		linkText,
		linkTextFr,
	} = event;

	const dateLocale = locale === "fr" ? "fr-CA" : "en-CA";

	return (
		<>
			<button
				className="ui-button ui-button-icon absolute right-4 top-4"
				onClick={() => void router.push("/schedule")}
				aria-label={t("close-event")}
			>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<title>{t("close-event")}</title>
					<path
						d="M24 0L0 24"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					></path>
					<path
						d="M0 0L24 24"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					></path>
				</svg>
			</button>

			<div className="flex flex-col font-rubik text-dark-color">
				<h1 className="ui-page-title">{locale === "fr" ? nameFr : name}</h1>
				<p className="text-lg">
					{start.toLocaleDateString(dateLocale, {
						weekday: "long",
						hour: "numeric",
						minute: "numeric",
					})}
					{" - "}
					{end.toLocaleDateString(dateLocale, {
						weekday: "long",
						hour: "numeric",
						minute: "numeric",
					})}
				</p>
				<h3 className="text-md">{room}</h3>
				{type !== "ALL" && <h3 className="text-md">{types[type]}</h3>}
				<h3 className="text-sm">{host}</h3>
				<button
					type="button"
					onClick={() => void handleNotifyToggle()}
					disabled={notifyPending || (!pushAvailable && !notifyRequested)}
					aria-busy={notifyPending}
					aria-pressed={notifyRequested}
					className={`mt-4 w-fit rounded-lg border px-4 py-2 font-coolvetica text-base transition-colors ${
						!pushAvailable && !notifyRequested
							? "cursor-not-allowed border-dark-secondary-color bg-light-tertiary-color text-dark-secondary-color opacity-60"
							: notifyRequested
								? "border-dark-color bg-dark-color text-light-color"
								: "border-dark-color bg-light-primary-color text-dark-color hover:bg-dark-secondary-color"
					}`}
				>
					{!pushAvailable
						? notifyRequested
							? t("notify-me-cancel-unavailable")
							: t("notify-me-unavailable")
						: notifyRequested
							? t("notify-me-active")
							: t("notify-me")}
				</button>
				{notifyError && (
					<p role="alert" className="mt-2 text-sm">
						{t("notify-me-error")}
					</p>
				)}
			</div>

			{image && (
				<div className="rounded">
					<Image src={image} width={350} height={325} alt={name} />
				</div>
			)}

			<EventInterestButton eventId={event.id} />

			{link && (
				<Link href={link} target="_blank" rel="noreferrer" className="ui-button">
					{locale === "fr" ? linkTextFr : linkText}
				</Link>
			)}

			<div className="flex flex-col font-rubik">
				<p className="text-xl">
					{(locale === "fr" ? descriptionFr : description).split(/\\n|\r?\n/).map((line, i, arr) => (
						<span key={i}>
							{line}
							{arr.length - 1 !== i && <br />}
						</span>
					))}
				</p>
			</div>
		</>
	);
};

export default EventPage;
