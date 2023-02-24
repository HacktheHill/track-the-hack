import type { Event } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";

import { trpc } from "../../utils/api";
import { eventTypes } from "./event";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "schedule"]),
	};
};

type TabsType = (typeof eventTypes)[keyof typeof eventTypes];

const Schedule: NextPage = () => {
	const [tab, setTab] = useState<TabsType>(eventTypes.ALL);

	const query = trpc.events.all.useQuery();

	const router = useRouter();
	const { locale } = router;

	let dateLocale = "en-CA";
	if (locale === "fr") {
		dateLocale = "fr-CA";
	}

	if (query.isLoading || query.data == null) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<Loading />
			</App>
		);
	} else if (query.isError) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={query.error.message} />
				</div>
			</App>
		);
	}

	if (query.data == null) {
		void router.push("/404");
	}

	let index = 0;

	return (
		<App
			className="flex h-full flex-col items-center bg-gradient-to-b from-background2 to-background1"
			integrated={true}
		>
			<Tabs tab={tab} setTab={setTab} />
			<div className="flex h-full w-full max-w-4xl flex-col gap-4 overflow-y-auto p-4 mobile:px-0">
				{query.data
					?.filter(event => eventTypes[event.type] === tab || tab === eventTypes.ALL)
					.sort((a, b) => {
						if (a.start.getTime() === b.start.getTime()) {
							return a.end.getTime() - b.end.getTime();
						}
						return a.start.getTime() - b.start.getTime();
					})
					.reduce((acc, event, i, array) => {
						if (array[i]?.start.getDate() === array[i - 1]?.start.getDate()) {
							acc[acc.length - 1]?.push(event);
						} else {
							acc.push([event]);
						}
						return acc;
					}, [] as Event[][])
					.map((event, i) => (
						<div key={i} className="flex gap-4">
							<div className="grid basis-1/3 place-content-center rounded-xl bg-dark/50 p-4 font-coolvetica text-2xl text-white">
								{event[0]?.start.toLocaleDateString(dateLocale, {
									month: "short",
									day: "numeric",
								})}
							</div>
							<div className="flex w-full flex-col gap-4">
								{event.map(event => {
									index++;
									return (
										<Link
											key={event.id}
											href={`/schedule/event?id=${event.id}`}
											className={`flex flex-col items-center justify-center gap-2 rounded-xl p-3 font-coolvetica text-dark ${
												index % 2 === 0 ? "bg-accent1" : "bg-accent2"
											}`}
										>
											<h1 className="text-center text-xl">{event.name}</h1>
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
		</App>
	);
};

type TabsProps = {
	tab: TabsType;
	setTab: (tab: TabsType) => void;
};

const Tabs = ({ tab, setTab }: TabsProps) => {
	return (
		<div className="sticky top-0 w-full border-b border-dark bg-background1 from-background2 px-4 pt-2 pb-4 shadow-navbar">
			<div className="mx-auto grid max-w-4xl grid-cols-3 gap-3 sm:grid-cols-5">
				{[...new Set([eventTypes.ALL, ...Object.values(eventTypes)])].map(name => (
					<Tab key={name} name={name} active={tab} onClick={() => setTab(name)} />
				))}
			</div>
		</div>
	);
};

type TabProps = {
	name: TabsType;
	active: TabsType;
	onClick: () => void;
};

const Tab = ({ name, active, onClick }: TabProps) => {
	return (
		<div
			className={`flex cursor-pointer flex-row items-center justify-center gap-2 rounded-xl bg-dark p-2 font-coolvetica text-white outline sm:p-4 ${
				name === active ? "outline-4 outline-white" : "outline-0"
			}`}
			onClick={onClick}
		>
			<h1 className="text-center text-lg">{name}</h1>
		</div>
	);
};

export default Schedule;
