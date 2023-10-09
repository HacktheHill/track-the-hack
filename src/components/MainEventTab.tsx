import { Card, Grid } from "@tremor/react";
import { type Prisma } from "@prisma/client";
import { CustomDonutChart, CustomSmallTextCard, EventsTable, InventoryTable } from "./Tremor_Custom";
import { getNumberPerValue } from "./DemographicsTab";
import { type typeStrKeyAnyVal } from "../utils/types";

import { Select, SelectItem } from "@tremor/react";

const InventoryData = [
	{
		title: "Small Kits",
		distributed: 20,
		forecasted: 100,
		unallocated: 50,
	},
	{
		title: "Medium Kits",
		distributed: 50,
		forecasted: 20,
		unallocated: 200,
	},
	{
		title: "Large Kits",
		distributed: 10,
		forecasted: 70,
		unallocated: 150,
	},
	{
		title: "Redbull",
		distributed: 120,
		forecasted: 400,
		unallocated: 600,
	},
];

const dinnerDay2 = [
	{
		title: "First Meal",
		value: 323,
	},
	{
		title: "Second Meal",
		value: 150,
	},
	{
		title: "Has not attended",
		value: 600,
	},
];

const attendeesState = [
	{
		title: "RSVP: Checked In",
		value: 200,
	},
	{
		title: "RSVP: Still Expected",
		value: 100,
	},
	{
		title: "Walkin: Checked In",
		value: 20,
	},
	{
		title: "Walkin Remaining",
		value: 65,
	},
];

const EventsData = [
	{
		title: "Checkin",
		state: false,
		utilization: 100,
	},
	{
		title: "Lunch Day 1",
		state: false,
		utilization: 97.2,
	},
	{
		title: "Dinner Day 1",
		state: true,
		utilization: 50.32,
	},
	{
		title: "Lunch Day 2",
		state: false,
		utilization: 0,
	},
];

interface MainEventTabProps {
	presenceData: Prisma.PresenceInfoGetPayload<true>[];
}

export default function MainEventTab({ presenceData }: MainEventTabProps) {
	const presenceKeysSet = new Set<string>();
	presenceData.forEach(presenceDatum => {
		Object.keys(presenceDatum).forEach(key => presenceKeysSet.add(key));
	});
	const demographicsKeys = Array.from(presenceKeysSet);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const metricsData: { [key: string]: { title: string; value: any; name: string }[] } = {};
	demographicsKeys.forEach(key => (metricsData[key] = []));

	presenceData.forEach((presenceDatum: typeStrKeyAnyVal) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
		demographicsKeys.forEach(key =>
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			metricsData[key]?.push({ title: key, value: presenceDatum[key], name: presenceDatum[key] }),
		);
	});

	const aggregatedMetricsData: {
		[key: string]: (typeStrKeyAnyVal & { name?: string; value?: number; title?: string })[];
	} = {};

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	presenceKeysSet.forEach(key => (aggregatedMetricsData[key] = getNumberPerValue(metricsData[key]!)));

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment
	// const totalConfirmedAttendees: number = aggregatedMetricsData.confirmed!.value!;

	// const eventsTableData = Object.entries(aggregatedMetricsData)
	// 	.filter(([key]) =>
	// 		[
	// 			"checkedIn",
	// 			"breakfast1",
	// 			"lunch1",
	// 			"dinner1",
	// 			"snacks",
	// 			"snacks2",
	// 			"breakfast2",
	// 			"lunch2",
	// 			"lunch22",
	// 		].includes(key),
	// 	)
	// 	.map(([key, datum]) => ({
	// 		title: key,
	// 		state: true,
	// 		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	// 		utilization: datum.value! / totalConfirmedAttendees,
	// 	}));
	return (
		<main className="mx-auto max-w-7xl p-4 md:p-10">
			<Grid numItems={1} className="gap-6">
				<Grid numItemsSm={3} numItemsLg={4} className="gap-6">
					<CustomSmallTextCard
						title="Total Checked In"
						metric={(attendeesState[0]?.value as number) + (attendeesState[2]?.value as number)}
					/>
					<CustomSmallTextCard
						title="RSVP Still Expected"
						metric={attendeesState[1]?.value}
						// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
						text={`Checked In ${attendeesState[0]?.value}`}
					/>
					<CustomSmallTextCard
						title="Walk ins Remaining"
						metric={attendeesState[3]?.value}
						// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
						text={`Checked In ${attendeesState[2]?.value}`}
					/>
					<CustomSmallTextCard title="Remaining Capacity" />
					<CustomSmallTextCard title="Discord User Count" />
					<CustomSmallTextCard title="Live Stream View Count" />
					<CustomSmallTextCard title="Active App Users" />
					<CustomSmallTextCard title="QR CODE SCANS" />
				</Grid>
				<Grid numItemsSm={1} numItemsLg={2} className="gap-6">
					<Card>
						{" "}
						<CustomDonutChart
							title="Check In Status"
							data={aggregatedMetricsData.checkedIn as { title: string; value: number }[]}
						/>{" "}
					</Card>
					<Card>
						<CustomDonutChart title="Dinner Day 2" data={dinnerDay2} />
						<Select>
							<SelectItem value="1">Dinner Day 2</SelectItem>
						</Select>
					</Card>
				</Grid>
				<Card>
					<EventsTable title="All Event States" data={EventsData} />
				</Card>

				<Card>
					<InventoryTable title="Inventory Status" data={InventoryData} />
				</Card>
			</Grid>
		</main>
	);
}
