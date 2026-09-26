import { EventType } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import ScheduleSaveButton from "@/components/ScheduleSaveButton";
import ScheduleEventDialog from "@/components/ScheduleEventDialog";
import { trpc, type RouterOutputs } from "@/server/api/api";
import { useHasParticipantPass } from "@/utils/participant-pass";
import { getEventRoom } from "@/utils/event-room";
import { groupScheduleEvents } from "@/utils/schedule-layout";
import { formatScheduleDate, formatScheduleTime, scheduleDayKey, scheduleDayKeys } from "@/utils/schedule-time";

type ScheduleEvent = RouterOutputs["events"]["all"][number];
const eventTypes = [
	EventType.ALL,
	EventType.GENERAL,
	EventType.COMPETITION,
	EventType.WORKSHOP,
	EventType.SOCIAL,
	EventType.CAREER_FAIR,
	EventType.FOOD,
];

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "schedule", "event"]),
});

const eventColor = (type: EventType) => {
	switch (type) {
		case EventType.WORKSHOP:
			return "bg-dark-primary-color text-light-color";
		case EventType.CAREER_FAIR:
			return "bg-light-secondary-color text-dark-primary-color";
		case EventType.FOOD:
			return "bg-medium-primary-color text-light-color";
		case EventType.SOCIAL:
			return "bg-highlight-color text-light-color";
		default:
			return "bg-dark-color text-light-color";
	}
};

const Schedule: NextPage = () => {
	const { t } = useTranslation("schedule");
	const { t: eventText } = useTranslation("event");
	const router = useRouter();
	const locale = router.locale === "fr" ? "fr-CA" : "en-CA";
	const hasPass = useHasParticipantPass();
	const view = hasPass && router.query.view === "mine" ? "mine" : "all";
	const tab = eventTypes.find(type => type === router.query.tab) ?? EventType.ALL;
	const eventId = typeof router.query.event === "string" ? router.query.event : null;
	const query = trpc.events.all.useQuery(undefined, { networkMode: "offlineFirst" });
	const saved = trpc.events.savedIds.useQuery(undefined, { enabled: hasPass, retry: false });
	const [now, setNow] = useState(() => Date.now());
	const todayKey = scheduleDayKey(new Date(now));
	const listRef = useRef<HTMLDivElement>(null);
	const openedFromList = useRef(false);
	const openButton = useRef<HTMLElement | null>(null);
	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(interval);
	}, []);
	useEffect(() => {
		if (!eventId && openButton.current) {
			requestAnimationFrame(() => {
				if (openButton.current && document.contains(openButton.current)) openButton.current.focus();
				else document.querySelector<HTMLElement>("[role='group'] [aria-pressed='true']")?.focus();
			});
		}
	}, [eventId]);

	const changeQuery = (changes: Record<string, string | undefined>, replace = false) => {
		const next = { ...router.query, ...changes };
		for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
		void router[replace ? "replace" : "push"]({ pathname: "/schedule", query: next }, undefined, {
			shallow: true,
			scroll: false,
		});
	};
	const openEvent = (id: string, trigger: HTMLElement) => {
		openButton.current = trigger;
		openedFromList.current = true;
		changeQuery({ event: id });
	};
	const closeEvent = () => {
		if (openedFromList.current) {
			openedFromList.current = false;
			router.back();
		} else {
			changeQuery({ event: undefined }, true);
		}
	};
	const jumpTo = (key: string) => {
		listRef.current?.querySelector<HTMLElement>(`[data-day="${key}"]`)?.scrollIntoView({ block: "start" });
	};
	const visible = useMemo(() => {
		const selected = new Set(saved.data ?? []);
		return (query.data ?? [])
			.filter(event =>
				view === "mine"
					? selected.has(event.id)
					: event.end.getTime() + 30 * 60_000 > now ||
						scheduleDayKey(new Date(event.end.getTime() - 1)) === todayKey,
			)
			.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
	}, [query.data, saved.data, view, now, todayKey]);
	const displayed = visible.filter(event => tab === EventType.ALL || event.type === tab);
	const days = useMemo(() => {
		const keys = [...new Set(displayed.flatMap(event => scheduleDayKeys(event.start, event.end)))]
			.filter(key => view === "mine" || key >= todayKey)
			.sort();
		return keys.map(key => ({
			key,
			date: new Date(`${key}T12:00:00Z`),
			events: displayed.filter(event => scheduleDayKey(event.start) === key),
			ongoing: displayed.filter(
				event => scheduleDayKey(event.start) < key && scheduleDayKeys(event.start, event.end).includes(key),
			),
		}));
	}, [displayed, view, todayKey]);
	const active = displayed.filter(event => event.start.getTime() <= now && event.end.getTime() > now);
	const next = displayed.find(event => event.start.getTime() > now);
	const jumpToNow = () => {
		const current = active.find(event => scheduleDayKey(event.start) === todayKey) ?? active[0];
		if (current) {
			const card = document.getElementById(`schedule-${current.id}`);
			const continuation = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-event-id]") ?? [])].find(
				item => item.dataset.eventId === current.id,
			);
			(continuation ?? card)?.scrollIntoView({ block: "center" });
		} else {
			const marker = listRef.current?.querySelector<HTMLElement>("[data-current-marker]");
			(marker ?? (next ? document.getElementById(`schedule-${next.id}`) : null))?.scrollIntoView({
				block: "center",
			});
		}
	};
	const canSave = hasPass && !saved.isError && saved.data != null;
	const sessionExpired = saved.error?.data?.code === "UNAUTHORIZED";
	const currentMarker = () => (
		<div data-current-marker className="flex items-center gap-3 py-1 font-coolvetica text-sm text-dark-color">
			<span className="shrink-0 rounded-full bg-light-secondary-color px-3 py-1">
				{t("time-marker-now")} · {formatScheduleTime(new Date(now), locale)}
			</span>
			<span className="h-px flex-1 bg-dark-color/50" aria-hidden="true" />
		</div>
	);

	// A background refresh can fail while the last successful schedule is usable.
	if (query.isError && query.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12" title={t("title")}>
				<h1 className="sr-only">{t("title")}</h1>
				<Error message={t("common:temporarily-unavailable")} />
			</App>
		);
	}
	if (query.fetchStatus === "paused" && query.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12" title={t("title")}>
				<h1 className="sr-only">{t("title")}</h1>
				<p className="text-center font-rubik text-dark-color" role="status">
					{t("common:offline-schedule-unavailable")}
				</p>
			</App>
		);
	}
	if (query.isLoading || query.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12" title={t("title")}>
				<h1 className="sr-only">{t("title")}</h1>
				<Loading />
			</App>
		);
	}

	return (
		<App className="flex h-0 flex-col bg-default-gradient" integrated title={t("title")}>
			<h1 className="sr-only">{t("title")}</h1>
			<div className="shrink-0 border-b border-dark-color bg-light-quaternary-color px-4 py-2 shadow-navbar">
				<div className="mx-auto flex max-w-2xl flex-col gap-2">
					{hasPass && (
						<div className="flex gap-2" role="group" aria-label={t("schedule-view")}>
							{(["all", "mine"] as const).map(choice => (
								<button
									key={choice}
									type="button"
									className="ui-button flex-1 py-1"
									aria-pressed={view === choice}
									onClick={() =>
										changeQuery({ view: choice === "mine" ? "mine" : undefined, tab: undefined })
									}
								>
									{t(choice === "mine" ? "my-schedule" : "all-events")}
								</button>
							))}
						</div>
					)}
					<div
						className="schedule-scroll-row flex gap-2 overflow-x-auto pb-1"
						role="group"
						aria-label={t("categories")}
					>
						{eventTypes.map(type => (
							<button
								key={type}
								type="button"
								className="ui-button shrink-0 px-3 py-1 text-sm"
								aria-pressed={tab === type}
								onClick={() => changeQuery({ tab: type === EventType.ALL ? undefined : type })}
							>
								{eventText(`type.${type}`)}
							</button>
						))}
					</div>
				</div>
			</div>
			<div ref={listRef} className="min-h-0 w-full overflow-y-auto px-4 py-5">
				<div className="mx-auto flex max-w-2xl flex-col gap-6">
					{hasPass && saved.isError && (
						<p role="alert" className="rounded-lg bg-light-secondary-color p-4 text-dark-color">
							{t(sessionExpired ? "pass-required" : "saved-load-error")}{" "}
							{sessionExpired ? (
								<button
									type="button"
									className="underline"
									onClick={() => changeQuery({ view: undefined, tab: undefined })}
								>
									{t("explore-events")}
								</button>
							) : (
								<button type="button" className="underline" onClick={() => void saved.refetch()}>
									{t("retry-saved")}
								</button>
							)}
						</p>
					)}
					{view === "mine" && !canSave && !saved.isError && (
						<p className="rounded-lg bg-light-secondary-color p-4 text-dark-color">{t("loading-saved")}</p>
					)}
					{(view === "all" || canSave) && (
						<>
							{days.length > 0 && (
								<nav
									className="schedule-scroll-row flex gap-2 overflow-x-auto pb-1"
									aria-label={t("jump-to-day")}
								>
									{(active.length > 0 || next) && (
										<button
											type="button"
											className="ui-button shrink-0 bg-dark-primary-color px-3 py-1 text-sm text-light-color"
											onClick={jumpToNow}
										>
											{t(active.length > 0 ? "jump-to-now" : "jump-to-next")}
										</button>
									)}
									{days.map(day => (
										<button
											key={day.key}
											type="button"
											className="ui-button shrink-0 px-3 py-1 text-sm"
											onClick={() => jumpTo(day.key)}
										>
											{formatScheduleDate(day.date, locale, {
												weekday: "short",
												month: "short",
												day: "numeric",
											})}
										</button>
									))}
								</nav>
							)}
							{days.length === 0 && (
								<p className="rounded-lg bg-light-secondary-color p-4">
									{t(
										view === "mine"
											? visible.length
												? "empty-events"
												: "empty-saved"
											: tab === EventType.ALL
												? "empty-upcoming"
												: "empty-events",
									)}
									{view === "mine" && (
										<button
											type="button"
											className="ml-2 underline"
											onClick={() =>
												changeQuery(
													visible.length
														? { tab: undefined }
														: { view: undefined, tab: undefined },
												)
											}
										>
											{t(visible.length ? "show-all-categories" : "explore-events")}
										</button>
									)}
								</p>
							)}
							{days.map(day => {
								const earlier: ScheduleEvent[] =
									view === "all" && day.key === todayKey
										? [...day.ongoing, ...day.events]
												.filter(event => event.end.getTime() <= now)
												.sort((a, b) => a.start.getTime() - b.start.getTime())
										: [];
								const currentEvents = day.events.filter(
									event => view === "mine" || day.key !== todayKey || event.end.getTime() > now,
								);
								const groups = groupScheduleEvents(currentEvents);
								const markerIndex =
									day.key === todayKey && next && scheduleDayKey(next.start) === day.key
										? groups.findIndex(group => group.events.some(event => event.id === next.id))
										: -1;
								return (
									<section key={day.key} data-day={day.key} className="min-w-0">
										<h2 className="mb-3 font-coolvetica text-2xl text-dark-color">
											{formatScheduleDate(day.date, locale, {
												weekday: "long",
												month: "short",
												day: "numeric",
											})}
										</h2>
										{day.ongoing
											.filter(event => !earlier.some(item => item.id === event.id))
											.map(event => (
												<button
													key={event.id}
													data-event-id={event.id}
													type="button"
													className="mb-2 flex w-full flex-wrap items-center gap-x-2 rounded-lg border border-dark-color bg-light-secondary-color px-3 py-2 text-left text-sm"
													onClick={e => openEvent(event.id, e.currentTarget)}
												>
													<strong>
														{t(event.end.getTime() <= now ? "ended" : "ongoing")}:{" "}
														{router.locale === "fr" ? event.nameFr : event.name}
													</strong>
													<span>
														{event.end.getTime() > now && <>{t("ends")} </>}
														{formatScheduleDate(event.end, locale, {
															weekday: "short",
															month: "short",
															day: "numeric",
														})}{" "}
														{formatScheduleTime(event.end, locale)}
													</span>
												</button>
											))}
										{earlier.length > 0 && (
											<details className="mb-3 rounded-lg bg-white/20 p-3">
												<summary className="cursor-pointer font-coolvetica text-dark-color">
													{t("earlier-today")} ({earlier.length})
												</summary>
												<div className="mt-3 flex flex-col gap-2">
													{earlier.map(event => (
														<button
															key={event.id}
															type="button"
															className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-light-secondary-color px-3 py-2 text-left text-dark-color"
															onClick={e => openEvent(event.id, e.currentTarget)}
														>
															<span className="font-coolvetica">
																{router.locale === "fr" ? event.nameFr : event.name}
															</span>
															<span className="text-sm">
																{scheduleDayKey(event.start) !== day.key &&
																	`${formatScheduleDate(event.start, locale, { month: "short", day: "numeric" })} `}
																{formatScheduleTime(event.start, locale)} –{" "}
																{formatScheduleTime(event.end, locale)} ·{" "}
																{getEventRoom(event, router.locale)}
															</span>
														</button>
													))}
												</div>
											</details>
										)}
										<div className="flex flex-col gap-3">
											{groups.map((group, index) => (
												<Fragment key={group.events[0]?.id}>
													{index === markerIndex && currentMarker()}
													<div
														className={`${group.overlapsPrevious ? "relative -mt-5" : ""} ${group.events.length > 1 ? "rounded-xl bg-white/20 p-2" : ""}`}
													>
														<div
															className={`grid gap-2 ${group.events.length > 1 ? `sm:grid-cols-2 ${group.events.length > 2 ? "md:grid-cols-3" : ""}` : ""}`}
														>
															{group.events.map(event => (
																<div
																	key={event.id}
																	id={`schedule-${event.id}`}
																	className={`relative min-w-0 rounded-lg shadow-sm ${eventColor(event.type)}`}
																>
																	<Link
																		href={`/schedule/event?id=${encodeURIComponent(event.id)}`}
																		onClick={e => {
																			if (
																				e.button === 0 &&
																				!e.metaKey &&
																				!e.ctrlKey &&
																				!e.shiftKey &&
																				!e.altKey
																			) {
																				e.preventDefault();
																				openEvent(event.id, e.currentTarget);
																			}
																		}}
																		className="flex min-h-24 min-w-0 flex-col justify-center rounded-lg px-4 py-3 pr-14 font-coolvetica hover:underline"
																	>
																		<h3 className="text-xl leading-tight">
																			{router.locale === "fr"
																				? event.nameFr
																				: event.name}
																		</h3>
																		<p className="mt-1 text-base leading-snug">
																			<time dateTime={event.start.toISOString()}>
																				{formatScheduleTime(
																					event.start,
																					locale,
																				)}
																			</time>
																			{" – "}
																			<time dateTime={event.end.toISOString()}>
																				{formatScheduleTime(event.end, locale)}
																				{scheduleDayKey(event.start) !==
																					scheduleDayKey(event.end) &&
																					` ${formatScheduleDate(event.end, locale, { month: "short", day: "numeric" })}`}
																			</time>
																		</p>
																		<p className="mt-1 text-base leading-snug">
																			{getEventRoom(event, router.locale)}
																		</p>
																		{view === "mine" &&
																			event.end.getTime() <= now && (
																				<span className="mt-1 text-sm">
																					{t("ended")}
																				</span>
																			)}
																		{event.start.getTime() <= now &&
																			event.end.getTime() > now && (
																				<span className="mt-1 text-sm">
																					{t("in-progress")}
																				</span>
																			)}
																	</Link>
																	{canSave && (
																		<ScheduleSaveButton
																			eventId={event.id}
																			eventName={
																				router.locale === "fr"
																					? event.nameFr
																					: event.name
																			}
																			interested={(saved.data ?? []).includes(
																				event.id,
																			)}
																		/>
																	)}
																</div>
															))}
														</div>
													</div>
												</Fragment>
											))}
											{day.key === todayKey &&
												!next &&
												active.some(event => scheduleDayKey(event.start) === day.key) &&
												currentMarker()}
										</div>
									</section>
								);
							})}
						</>
					)}
				</div>
			</div>
			{eventId && <ScheduleEventDialog id={eventId} onClose={closeEvent} />}
		</App>
	);
};

export default Schedule;
