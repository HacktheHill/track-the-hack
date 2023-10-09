import { TabGroup, TabList, Tab, TabPanels, TabPanel } from "@tremor/react";

import DemographicsTab from "../../components/DemographicsTab";
import MainEventTab from "../../components/MainEventTab";

import { Role, type Prisma, PresenceInfo } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { trpc } from "../../utils/api";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

import App from "../../components/App";
import OnlyRole from "../../components/OnlyRole";

type HackerInfo = Prisma.HackerInfoGetPayload<true>;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "hacker"]),
	};
};

const Metrics: NextPage = () => {
	const { t } = useTranslation("common");
	const { ...hackerQuery } = trpc.hackers.all.useInfiniteQuery(
		{
			limit: 50,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);
	const presenceQuery = trpc.presence.all.useInfiniteQuery(
		{
			limit: 50,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);

	const hackers = hackerQuery.data?.pages.map(page => page.results).flat() as HackerInfo[];
	const presences = presenceQuery.data?.pages.map(page => page.results).flat() as PresenceInfo[];

	return (
		<App className="mx-auto h-full w-full overflow-y-auto bg-gradient-to-b from-background2 to-background1 px-4 py-12">
			<div className="mx-auto flex max-w-2xl flex-col gap-4">
				<OnlyRole filter={role => role === Role.ORGANIZER}>
					<MetricsView hackerData={hackers} presenceData={presences} />
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>{t("not-authorized-to-view-this-page")}</OnlyRole>
			</div>
		</App>
	);
};

type MetricsViewProps = {
	hackerData: HackerInfo[];
	presenceData: PresenceInfo[];
};

export const MetricsView = ({ hackerData, presenceData }: MetricsViewProps) => {
	return (
		<main className="mx-auto max-w-7xl p-4 md:p-10">
			<TabGroup>
				<TabList className="mt-8">
					<Tab>Hacker Demographics</Tab>
					<Tab>Main Event</Tab>
					<Tab>Action Log</Tab>
				</TabList>
				<TabPanels>
					<TabPanel>
						<DemographicsTab hackerData={hackerData} />
					</TabPanel>
					<TabPanel>
						<MainEventTab presenceData={presenceData} />
					</TabPanel>
					<TabPanel>Not Integrated...</TabPanel>
				</TabPanels>
			</TabGroup>
		</main>
	);
};

export default Metrics;
