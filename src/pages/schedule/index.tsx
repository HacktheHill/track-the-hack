import { EventType } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import ScheduleEventDialog from "@/components/ScheduleEventDialog";
import { trpc, type RouterOutputs } from "@/server/api/api";
import { useHasParticipantPass } from "@/utils/participant-pass";
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
	const view = router.query.view === "mine" ? "mine" : "all";
	const tab = eventTypes.find(type => type === router.query.tab) ?? EventType.ALL;
	const eventId = typeof router.query.event === "string" ? router.query.event : null;
	const query = trpc.events.all.useQuery();
	const saved = trpc.events.savedIds.useQuery(undefined, { enabled: hasPass, retry: false });
	const utils = trpc.useUtils();
	const update = trpc.events.setInterest.useMutation({
		onSuccess: (interested, input) => {
			utils.events.savedIds.setData(undefined, previous => {
				const ids = previous ?? [];
				return interested ? [...new Set([...ids, input.eventId])] : ids.filter(id => id !== input.eventId);
			});
			utils.events.getInterest.setData({ eventId: input.eventId }, interested);
		},
	});
	const [now, setNow] = useState(() => Date.now());
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
	const jumpToEvent = (event: ScheduleEvent, trigger: HTMLElement) => {
		const card = document.getElementById(`schedule-${event.id}`);
		if (card && !(event.start.getTime() < now && scheduleDayKey(event.start) !== scheduleDayKey(new Date(now)))) {
			card.scrollIntoView({ block: "center" });
		} else {
			openEvent(event.id, trigger);
		}
	};

	const visible = useMemo(() => {
		const selected = new Set(saved.data ?? []);
		return (query.data ?? [])
			.filter(event => (view === "mine" ? selected.has(event.id) : event.end.getTime() + 30 * 60_000 > now))
			.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
	}, [query.data, saved.data, view, now]);
	const displayed = visible.filter(event => tab === EventType.ALL || event.type === tab);
	const days = useMemo(() => {
		const keys = [...new Set(displayed.flatMap(event => scheduleDayKeys(event.start, event.end)))].sort();
		return keys.map(key => ({
			key,
			date: new Date(`${key}T12:00:00Z`),
			events: displayed.filter(event => scheduleDayKey(event.start) === key),
			ongoing: displayed.filter(
				event => scheduleDayKey(event.start) < key && scheduleDayKeys(event.start, event.end).includes(key),
			),
		}));
	}, [displayed]);
	const active = visible.filter(event => event.start.getTime() <= now && event.end.getTime() > now);
	const future = visible.filter(event => event.start.getTime() > now);
	const nextStart = future[0]?.start.getTime();
	const next = future.filter(event => event.start.getTime() === nextStart);
	const canSave = hasPass && !saved.isError && saved.data != null;
	const needsPass = !hasPass || saved.error?.data?.code === "UNAUTHORIZED";

	if (query.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={t("common:temporarily-unavailable")} />
			</App>
		);
	}
	if (query.isLoading || query.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Loading />
			</App>
		);
	}

	return (
		<App className="flex h-0 flex-col bg-default-gradient" integrated title={t("title")}>
			<div className="shrink-0 border-b border-dark-color bg-light-quaternary-color px-4 py-2 shadow-navbar">
				<div className="mx-auto flex max-w-2xl flex-col gap-2">
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
					<div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("categories")}>
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
							{t(needsPass ? "pass-required" : "saved-load-error")}{" "}
							{needsPass ? (
								<Link className="underline" href="/pass">
									{t("open-pass")}
								</Link>
							) : (
								<button type="button" className="underline" onClick={() => void saved.refetch()}>
									{t("retry-saved")}
								</button>
							)}
						</p>
					)}
					{view === "mine" && !canSave && !saved.isError && (
						<p className="rounded-lg bg-light-secondary-color p-4 text-dark-color">
							{hasPass && saved.isLoading ? t("loading-saved") : t("pass-required")}{" "}
							{!hasPass && (
								<Link className="underline" href="/pass">
									{t("open-pass")}
								</Link>
							)}
						</p>
					)}
					{(view === "all" || canSave) && (
						<>
							<div className={`grid gap-2 ${active.length && next.length ? "sm:grid-cols-2" : ""}`}>
								{(
									[
										[t("now"), active, t("nothing-now")],
										[t("next"), next, t("nothing-next")],
									] as const
								)
									.filter((_, index) => index !== 0 || active.length > 0 || next.length === 0)
									.map(([label, items, empty]) => (
										<div
											key={label}
											className="min-w-0 rounded-lg bg-light-secondary-color/90 p-2 text-dark-color sm:p-3"
										>
											<h2 className="font-coolvetica text-lg">
												{label}
												{label === t("next") && next[0] && (
													<span className="ml-2 font-rubik text-sm font-normal">
														{formatScheduleDate(next[0].start, locale, {
															weekday: "short",
															day: "numeric",
															month: "short",
														})}{" "}
														{formatScheduleTime(next[0].start, locale)}
													</span>
												)}
											</h2>
											{items.length ? (
												<div className="flex flex-wrap gap-x-3 gap-y-1">
													{items.slice(0, 3).map(event => (
														<button
															key={event.id}
															type="button"
															className="text-left text-sm underline underline-offset-2"
															onClick={e => jumpToEvent(event, e.currentTarget)}
														>
															{router.locale === "fr" ? event.nameFr : event.name}
															{event.room && ` · ${event.room}`}
														</button>
													))}
													{items.length > 3 && (
														<span className="text-sm">
															{t("more-events", { count: items.length - 3 })}
														</span>
													)}
												</div>
											) : (
												<p className="text-sm">{empty}</p>
											)}
										</div>
									))}
							</div>
							{days.length > 0 && (
								<nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t("jump-to-day")}>
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
							{days.map(day => (
								<section key={day.key} data-day={day.key} className="min-w-0">
									<h2 className="mb-3 font-coolvetica text-2xl text-dark-color">
										{formatScheduleDate(day.date, locale, {
											weekday: "long",
											month: "short",
											day: "numeric",
										})}
									</h2>
									{day.ongoing.map(event => (
										<button
											key={event.id}
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
									<div className="flex flex-col gap-3">
										{groupScheduleEvents(day.events).map(group => (
											<div
												key={group.events[0]?.id}
												className={`${group.overlapsPrevious ? "relative -mt-5" : ""} ${group.events.length > 1 ? "rounded-xl bg-white/20 p-2" : ""}`}
											>
												{group.events.length > 1 && (
													<p className="mb-2 px-1 font-coolvetica text-sm text-dark-color">
														{t("at-the-same-time")}
													</p>
												)}
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
																	{router.locale === "fr" ? event.nameFr : event.name}
																</h3>
																<p className="mt-1 text-base leading-snug">
																	<time dateTime={event.start.toISOString()}>
																		{formatScheduleTime(event.start, locale)}
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
																	{event.room}
																</p>
																{view === "mine" && event.end.getTime() <= now && (
																	<span className="mt-1 text-sm">{t("ended")}</span>
																)}
															</Link>
															{canSave && (
																<button
																	type="button"
																	className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-current bg-white/90 text-xl text-dark-color"
																	aria-label={t(
																		(saved.data ?? []).includes(event.id)
																			? "remove-from-schedule"
																			: "save-to-schedule",
																		{
																			name:
																				router.locale === "fr"
																					? event.nameFr
																					: event.name,
																		},
																	)}
																	aria-pressed={(saved.data ?? []).includes(event.id)}
																	disabled={update.isLoading}
																	onClick={() =>
																		update.mutate({
																			eventId: event.id,
																			interested: !(saved.data ?? []).includes(
																				event.id,
																			),
																		})
																	}
																>
																	{(saved.data ?? []).includes(event.id) ? "★" : "☆"}
																</button>
															)}
														</div>
													))}
												</div>
											</div>
										))}
									</div>
								</section>
							))}
						</>
					)}
					{update.isError && <p role="alert">{eventText("interest-error")}</p>}
				</div>
			</div>
			{eventId && <ScheduleEventDialog id={eventId} onClose={closeEvent} />}
		</App>
	);
};

export default Schedule;
