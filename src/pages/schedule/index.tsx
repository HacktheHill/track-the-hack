import type { Event } from "@prisma/client";
import { EventType } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { useRouter } from "next/router";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";

import { trpc } from "../../server/api/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "schedule", "event"]),
	};
};

const Schedule: NextPage = () => {
	const { t } = useTranslation("schedule");

	const router = useRouter();
	const { locale } = router;

	const query = trpc.events.all.useQuery();

	let dateLocale = "en-CA";
	if (locale === "fr") {
		dateLocale = "fr-CA";
	}

	if (query.isLoading || query.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Loading />
			</App>
		);
	} else if (query.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={query.error.message} />
			</App>
		);
	}

	if (query.data == null) {
		void router.push("/404");
	}

	const eventColor = (eventType: string) => {
		switch (eventType) {
			case EventType.WORKSHOP:
				return "bg-dark-primary-color text-light-color";
			case EventType.CAREER_FAIR:
				return "bg-light-primary-color text-light-color";
			case EventType.FOOD:
				return "bg-medium-primary-color text-light-color";
			case EventType.SOCIAL:
				return "bg-highlight-color text-light-color";
			default:
				return "bg-dark-color text-light-color";
		}
	};

	const tab =
		typeof router.query.tab === "string" && Object.keys(EventType).includes(router.query.tab)
			? (router.query.tab as EventType)
			: EventType.ALL;

	const events = query.data
		.filter(event => !event.hidden)
		.filter(event => event.end.getTime() + 30 * 60 * 1000 > Date.now())
		.filter(event => EventType[event.type] === tab || tab === EventType.ALL)
		.sort((a, b) => {
			if (a.start.getTime() === b.start.getTime()) {
				return a.end.getTime() - b.end.getTime();
			}
			return a.start.getTime() - b.start.getTime();
		})
		.reduce((acc, event, i, array) => {
			if (array[i]?.start.toLocaleDateString(dateLocale) === array[i - 1]?.start.toLocaleDateString(dateLocale)) {
				acc[acc.length - 1]?.push(event);
			} else {
				acc.push([event]);
			}
			return acc;
		}, [] as Event[][]);

	return (
		<App className="flex h-0 flex-col items-center bg-default-gradient" integrated={true} title={t("title")}>
			<Tabs tab={tab} setTab={tab => void router.push(`/schedule?tab=${tab}`)} />
			<div className="w-full overflow-y-auto p-4 mobile:px-0">
				<div className="mx-auto flex max-w-2xl flex-col gap-4">
					{events.map((event, i) => (
						<div key={i} className="flex gap-4">
							<div className="bg-dark/50 grid rounded-lg p-4 font-coolvetica text-2xl text-dark-color">
								{event[0]?.start.toLocaleDateString(dateLocale, {
									month: "short",
									day: "numeric",
								})}
							</div>
							<div className="flex w-full flex-col gap-4">
								{event.map(event => {
									return (
										<Link
											key={event.id}
											href={`/schedule/event?id=${event.id}`}
											className={`flex flex-col items-center justify-center gap-2 rounded-lg p-3 font-coolvetica ${eventColor(
												event.type,
											)}`}
										>
											<h1 className="text-center text-xl">
												{locale === "fr" ? event.nameFr : event.name}
											</h1>
											<p className="text-center leading-3">
												{event.start.toLocaleTimeString(dateLocale, {
													hour: "numeric",
													minute: "numeric",
												})}
												{" - "}
												{event.end.toLocaleTimeString(dateLocale, {
													hour: "numeric",
													minute: "numeric",
												})}
											</p>
											<p>{event.room}</p>
										</Link>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>
		</App>
	);
};

type TabsProps = {
	tab: EventType;
	setTab: (tab: EventType) => void;
};

const Tabs = ({ tab, setTab }: TabsProps) => {
	return (
		<div className="w-full border-b border-dark-color bg-light-quaternary-color px-4 pb-4 pt-2 shadow-navbar">
			<div className="mx-auto grid max-w-2xl grid-cols-3 gap-3 sm:grid-cols-5">
				{Object.keys(EventType)
					.sort(a => (a === EventType.ALL ? -1 : 0))
					.map(type => (
						<Tab
							key={type}
							type={type as keyof typeof EventType}
							active={tab}
							onClick={() => setTab(type as keyof typeof EventType)}
						/>
					))}
			</div>
		</div>
	);
};

type TabProps = {
	type: EventType;
	active: EventType;
	onClick: () => void;
};

const Tab = ({ type, active, onClick }: TabProps) => {
	const { t } = useTranslation("event");

	const types = {
		[EventType.ALL]: t("type.ALL"),
		[EventType.CAREER_FAIR]: t("type.CAREER_FAIR"),
		[EventType.FOOD]: t("type.FOOD"),
		[EventType.SOCIAL]: t("type.SOCIAL"),
		[EventType.WORKSHOP]: t("type.WORKSHOP"),
	};

	return (
		<div
			className={`flex cursor-pointer flex-row items-center justify-center gap-2 rounded-lg bg-dark-primary-color p-2 font-coolvetica text-light-color outline sm:p-4 ${
				type === active ? "outline-4 outline-light-color" : "outline-0"
			}`}
			onClick={onClick}
			onKeyDown={e => {
				if (e.key === "Enter") {
					onClick();
				}
			}}
		>
			<h1 className="text-center text-lg">{types[type]}</h1>
		</div>
	);
};

export default Schedule;
