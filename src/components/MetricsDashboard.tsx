"use client";

import { TabGroup, TabList, Tab, TabPanels, TabPanel } from "@tremor/react";

import DemographicsTab from "./DemographicsTab";
import MainEventTab from "./MainEventTab";
export default function MetricsDashboard() {
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
						<DemographicsTab />
					</TabPanel>
					<TabPanel>
						<MainEventTab />
					</TabPanel>
					<TabPanel>Not Integrated...</TabPanel>
				</TabPanels>
			</TabGroup>
		</main>
	);
}
