import { TabGroup, TabList, Tab, TabPanels, TabPanel } from "@tremor/react";

import DemographicsTab from "../../components/DemographicsTab";

import { Role, type Prisma } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

import App from "../../components/App";
import OnlyRole from "../../components/OnlyRole";

type HackerInfo = Prisma.HackerInfoGetPayload<true>;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "hacker"]),
	};
};

interface MetricsProps {
	hackerData: HackerInfo[];
}

const Metrics: NextPage = ({ hackerData }: MetricsProps) => {
	return (
		<App className="mx-auto h-full w-full overflow-y-auto bg-gradient-to-b from-background2 to-background1 px-4 py-12">
			<div className="mx-auto flex max-w-2xl flex-col gap-4">
				<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
					<MetricsView hackerData={hackerData} />
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>{t("not-authorized-to-view-this-page")}</OnlyRole>
			</div>
		</App>
	);
};

type MetricsViewProps = {
	hackerData: HackerInfo;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const MetricsView = ({ hackerData }: MetricsViewProps) => {
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
					{/* <TabPanel>
						<MainEventTab presenceData={presenceData} />
					</TabPanel> */}
					<TabPanel>Not Integrated...</TabPanel>
				</TabPanels>
			</TabGroup>
		</main>
	);
};

export default Metrics;
