import type { EventType } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";

import { trpc } from "../../utils/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "schedule"]),
	};
};

const tabs = {
	ALL: "All",
	WORKSHOP: "Workshops",
	CAREER_FAIR: "Career Fair",
	FOOD: "Food",
	SOCIAL: "Social",
} as const satisfies Record<EventType, string>;

type TabsType = (typeof tabs)[keyof typeof tabs];

const Schedule: NextPage = () => {
	const [tab, setTab] = useState<TabsType>(tabs.ALL);

	const query = trpc.events.all.useQuery(undefined, {
		staleTime: 1000 * 60 * 5,
	});

	const router = useRouter();

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

	return (
		<App className="flex h-full flex-col gap-4 bg-gradient-to-b from-background2 to-background1 px-16 py-12">
			<Tabs tab={tab} setTab={setTab} />
			<div className="flex flex-col gap-4">
				{query.data
					?.filter(event => tabs[event.type] === tab || tab === tabs.ALL)
					.map((event, i) => (
						<Link
							key={event.id}
							href={`/schedule/event?id=${event.id}`}
							className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 font-[Coolvetica] text-dark ${
								i % 2 === 0 ? "bg-accent1" : "bg-accent2"
							}`}
						>
							<h1 className="text-xl">{event.name}</h1>
							<p>
								<Time time={event.start} /> - <Time time={event.end} />
							</p>
							<p>{event.room}</p>
						</Link>
					))}
			</div>
		</App>
	);
};

const Time = ({ time }: { time: Date }) => {
	return (
		<>
			{time.getHours().toString().padStart(2, "0")}:{time.getMinutes().toString().padStart(2, "0")}
		</>
	);
};

type TabsProps = {
	tab: TabsType;
	setTab: (tab: TabsType) => void;
};

const Tabs = ({ tab, setTab }: TabsProps) => {
	return (
		// 2 on mobile, 3 on tablet, 5 on desktop
		<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
			{[...new Set([tabs.ALL, ...Object.values(tabs)])].map(name => (
				<Tab key={name} name={name} active={tab} onClick={() => setTab(name)} />
			))}
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
			className={`flex flex-row items-center justify-center gap-2 rounded-xl bg-dark p-4 font-[Coolvetica] text-white outline ${
				name === active ? "outline-4 outline-white" : "outline-0"
			}`}
			onClick={onClick}
		>
			<h1 className="text-center text-xl">{name}</h1>
		</div>
	);
};

export default Schedule;
