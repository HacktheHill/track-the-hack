/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Card, Grid } from "@tremor/react";
import { type Prisma } from "@prisma/client";
import { CustomDonutChart, CustomSmallTextCard, EventsTable, InventoryTable } from "./Tremor_Custom";
import type { AggregatedHackerInfo, AggregatedPresenceInfo } from "../utils/types";

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

interface MainEventTabProps {
	aggregatedHackerData: AggregatedHackerInfo;
	aggregatedPresenceData: AggregatedPresenceInfo;
	hackerData: Prisma.HackerInfoGetPayload<true>[];
	presenceData: Prisma.PresenceInfoGetPayload<true>[];
}

export default function MainEventTab({
	aggregatedHackerData,
	aggregatedPresenceData,
	hackerData,
	presenceData,
}: MainEventTabProps) {
	const totalConfirmedAttendees: number = aggregatedHackerData.confirmed!.filter(
		dataValue => dataValue.name === "Yes",
	)[0]!.value as number;
	const totalCheckedIn = aggregatedPresenceData.checkedIn!.filter(dataValue => dataValue.name === "Yes")[0]!.value;
	const rsvpStillExpected = totalConfirmedAttendees - totalCheckedIn;
	const remainingWalkIns = presenceData.filter(presenceDatum => {
		const matchingHackerInfos = hackerData.filter(hackerDatum => hackerDatum.id === presenceDatum.hackerInfoId);

		if (matchingHackerInfos.length === 0) {
			return false;
		}

		const hackerInfo = matchingHackerInfos[0];

		return hackerInfo!.walkIn && !presenceDatum.checkedIn;
	}).length;

	const eventsTableData = Object.entries(aggregatedPresenceData)
		.filter(([key]) =>
			[
				"checkedIn",
				"breakfast1",
				"lunch1",
				"dinner1",
				"snacks",
				"snacks2",
				"breakfast2",
				"lunch2",
				"lunch22",
			].includes(key),
		)
		.map(([key, datum]) => ({
			title: key,
			state: true,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			utilization: datum.filter(dataValue => dataValue.name === "Yes")[0]!.value / totalConfirmedAttendees,
		}));

	return (
		<main className="mx-auto max-w-7xl p-4 md:p-10">
			<Grid numItems={1} className="gap-6">
				<Grid numItemsSm={3} numItemsLg={4} className="gap-6">
					<CustomSmallTextCard title="Total Checked In" metric={totalCheckedIn} />
					<CustomSmallTextCard
						title="RSVP Still Expected"
						metric={rsvpStillExpected}
						// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
						text={`Checked In ${totalCheckedIn}`}
					/>
					<CustomSmallTextCard
						title="Walk ins Remaining"
						metric={remainingWalkIns}
						// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
						text={`Checked In ${totalCheckedIn}`}
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
							data={aggregatedPresenceData.checkedIn as { title: string; value: number }[]}
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
					<EventsTable title="All Event States" data={eventsTableData} />
				</Card>

				<Card>
					<InventoryTable title="Inventory Status" data={InventoryData} />
				</Card>
			</Grid>
		</main>
	);
}
