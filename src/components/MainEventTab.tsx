/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Card, Grid } from "@tremor/react";
import { type Prisma } from "@prisma/client";
import {
	CustomDonutChart,
	CustomSmallTextCard,
	CheckInEventsChart,
	EventsTable,
	InventoryTable,
} from "./Tremor_Custom";
import type { AggregatedHackerInfo, AggregatedPresenceInfo } from "../utils/types";

const checkInEvents = {
	checkedIn: "Checked In",
	breakfast1: "Breakfast 1",
	lunch1: "Lunch 1",
	dinner1: "Dinner 1",
	snacks: "Snacks",
	snacks2: "Snacks 2",
	breakfast2: "Breakfast 1",
	lunch2: "Lunch 2",
	lunch22: "Lunch 2 2 (Dinner 2?)",
};

// TODO: remove InventoryData once this data is in the db
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
	const totalConfirmedAttendees: number = aggregatedHackerData.confirmed!.filter(dataValue =>
		Object.keys(dataValue).includes("Yes"),
	)[0]!.Yes! as number;
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
		.filter(([key]) => Object.keys(checkInEvents).includes(key))
		.map(([key, datum]) => {
			const utilizedEventData = datum.filter(dataValue => dataValue.name === "Yes");
			return {
				title: key,
				state: true, // TODO: not sure how event state (open/closed) will be stored in the db
				utilization: utilizedEventData.length > 0 ? utilizedEventData[0]!.value / totalConfirmedAttendees : 0,
			};
		});

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
						<CheckInEventsChart
							title="Meals and Snacks"
							// TODO: should show how many people had 0, 1, 2, etc check ins for the event once that info is in the db
							data={Object.entries(aggregatedPresenceData)
								.filter(([key]) => key != "checkedIn" && Object.keys(checkInEvents).includes(key))
								.reduce((acc, [key, datum]) => ({ ...acc, [key]: [...datum] }), {})}
							selectKeys={Object.keys(checkInEvents)}
							eventNameMapping={checkInEvents}
						/>
					</Card>
				</Grid>
				<Card>
					<EventsTable title="All Event States" data={eventsTableData} eventNameMapping={checkInEvents} />
				</Card>

				<Card>
					<InventoryTable title="Inventory Status" data={InventoryData} />
				</Card>
			</Grid>
		</main>
	);
}
