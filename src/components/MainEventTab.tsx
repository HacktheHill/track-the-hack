import { Card, Grid } from "@tremor/react";
import type { HackerInfo, PresenceInfo } from "@prisma/client";
import {
	CustomDonutChart,
	CustomSmallTextCard,
	MultiCheckInEventsChart,
	EventsTable,
	InventoryTable,
} from "./Tremor_Custom";
import { keyToLabel } from "../pages/hackers/hacker";
import type { AggregatedHackerInfo, AggregatedPresenceInfo } from "../utils/types";

const multiCheckInEventsKeyToLabel = Object.entries({
	...keyToLabel,
	redbull: "Redbull",
})
	.filter(([key]) => key !== "checkedIn")
	.reduce((acc, [key, label]) => ({ ...acc, [key]: label }), {}) as Record<
	keyof Omit<PresenceInfo, "id" | "hackerInfoId" | "checkedIn">,
	string
>;

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
	hackerData: HackerInfo[];
	presenceData: PresenceInfo[];
}

export default function MainEventTab({
	aggregatedHackerData,
	aggregatedPresenceData,
	hackerData,
	presenceData,
}: MainEventTabProps) {
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const totalConfirmedAttendees = aggregatedHackerData.confirmed.filter(
		dataValue => dataValue.name === "Yes",
	)[0]?.value;
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const totalCheckedIn = aggregatedPresenceData.checkedIn.filter(dataValue => dataValue.name === "Yes")[0]?.value;
	const rsvpStillExpected = totalConfirmedAttendees && totalCheckedIn ? totalConfirmedAttendees - totalCheckedIn : 0;
	const remainingWalkIns = presenceData.filter(presenceDatum => {
		const matchingHackerInfos = hackerData.filter(hackerDatum => hackerDatum.id === presenceDatum.hackerInfoId);

		if (matchingHackerInfos.length === 0) {
			return false;
		}

		const hackerInfo = matchingHackerInfos[0];

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return hackerInfo!.walkIn && !presenceDatum.checkedIn;
	}).length;

	const multiCheckInEventsData = Object.entries(aggregatedPresenceData)
		.filter(([key]) => key !== "checkedIn" && Object.keys(multiCheckInEventsKeyToLabel).includes(key))
		.reduce((acc, [key, datum]) => ({ ...acc, [key]: [...datum] }), {});

	const eventsTableData = Object.entries(aggregatedPresenceData)
		.filter(([key]) => Object.keys(multiCheckInEventsKeyToLabel).includes(key))
		.map(([key, datum]) => {
			const utilizedEventData = datum.filter(dataValue => dataValue.name === "Yes");
			return {
				title: key,
				state: true, // TODO: not sure how event state (open/closed) will be stored in the db
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				utilization: ((utilizedEventData.length > 0) && (totalConfirmedAttendees ?? 0 > 0)) ? utilizedEventData[0]!.value / (totalConfirmedAttendees ?? 0) : 0,
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
					<CustomSmallTextCard title="Remaining Capacity" /> {/* TODO: implement once in db */}
					<CustomSmallTextCard title="Discord User Count" /> {/* TODO: implement once in db */}
					<CustomSmallTextCard title="Live Stream View Count" /> {/* TODO: implement once in db */}
					<CustomSmallTextCard title="Active App Users" /> {/* TODO: implement once in db */}
					<CustomSmallTextCard title="QR CODE SCANS" /> {/* TODO: implement once in db */}
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
						<MultiCheckInEventsChart
							title="Multi-Check-In Events"
							// TODO: should show how many people had 0, 1, 2, etc check ins for the event once that info is in the db
							data={multiCheckInEventsData}
							selectKeys={Object.keys(multiCheckInEventsKeyToLabel).filter(key => key !== "checkedIn")}
							eventKeyToLabel={multiCheckInEventsKeyToLabel}
						/>
					</Card>
				</Grid>
				<Card>
					<EventsTable
						title="All Event States"
						data={eventsTableData}
						eventKeyToLabel={multiCheckInEventsKeyToLabel}
					/>
				</Card>

				<Card>
					<InventoryTable title="Inventory Status" data={InventoryData} />
				</Card>
			</Grid>
		</main>
	);
}
