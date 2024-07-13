import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@tremor/react";
import { useEffect, useState } from "react";

import DemographicsTab from "../../components/DemographicsTab";
import MainEventTab from "../../components/MainEventTab";
import { getAggregatedHackerInfo, getAggregatedPresenceInfo } from "../../utils/getAggregatedData";

import { RoleName, type HackerInfo, type PresenceInfo } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { trpc } from "../../utils/api";

import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";
import Loading from "../../components/Loading";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "internal", "navbar"]),
	};
};

const Metrics: NextPage = () => {
	const { t } = useTranslation("internal");

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
			<Filter value={RoleName.ORGANIZER} method="above">
				<MetricsDisplay />
				<Error message={t("unauthorized")} />
			</Filter>
		</App>
	);
};

const MetricsDisplay = () => {
	const { status: hackerStatus, ...hackerQuery } = trpc.hackers.all.useInfiniteQuery(
		{
			limit: 50,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);
	const { status: presenceStatus, ...presenceQuery } = trpc.presence.all.useInfiniteQuery(
		{
			limit: 50,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);

	if (hackerStatus === "loading" || presenceStatus === "loading") {
		return <Loading />;
	} else if (hackerStatus === "error" || presenceStatus === "error") {
		return (
			<div className="x-16 flex h-full flex-col items-center justify-center gap-4 px-16 py-12">
				<Error message={hackerQuery.error?.message ?? presenceQuery.error?.message ?? ""} />
			</div>
		);
	} else {
		const hackers = hackerQuery.data?.pages.map(page => page.results).flat();
		const presences = presenceQuery.data?.pages.map(page => page.results).flat();

		if (!hackers || !presences) {
			return (
				<div className="flex flex-col items-center justify-center gap-4 px-16 py-12">
					<Error message={`No ${!hackers ? "hackers" : ""} ${!presences ? "presences" : ""} info`} />
				</div>
			);
		}

		return <MetricsView hackerData={hackers} presenceData={presences} />;
	}
};

type MetricsViewProps = {
	hackerData: HackerInfo[];
	presenceData: PresenceInfo[];
};

export const MetricsView = ({ hackerData, presenceData }: MetricsViewProps) => {
	const [aggregatedHackerData, setAggregatedHackerData] = useState(getAggregatedHackerInfo(hackerData));
	const [aggregatedPresenceData, setAggregatedPresenceData] = useState(getAggregatedPresenceInfo(presenceData));

	useEffect(() => {
		setAggregatedHackerData(getAggregatedHackerInfo(hackerData));
	}, [hackerData]);

	useEffect(() => {
		setAggregatedPresenceData(getAggregatedPresenceInfo(presenceData));
	}, [presenceData]);

	return (
		<TabGroup className="mx-auto flex max-w-7xl flex-col gap-5 p-10">
			<div>
				<TabList className="flex justify-between rounded-lg border-none bg-dark-primary-color p-3">
					<Tab className="border-none">Hacker Demographics</Tab>
					<Tab className="border-none">Main Event</Tab>
				</TabList>
			</div>
			<TabPanels>
				<TabPanel>
					<DemographicsTab aggregatedHackerData={aggregatedHackerData} hackerData={hackerData} />
				</TabPanel>
				<TabPanel>
					<MainEventTab
						aggregatedHackerData={aggregatedHackerData}
						aggregatedPresenceData={aggregatedPresenceData}
						hackerData={hackerData}
						presenceData={presenceData}
					/>
				</TabPanel>
			</TabPanels>
		</TabGroup>
	);
};

export default Metrics;
