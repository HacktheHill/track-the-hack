/* eslint-disable @typescript-eslint/no-non-null-assertion */
"use client";

import { type Prisma } from "@prisma/client";

import { Card, Grid, Select, SelectItem } from "@tremor/react";
import type { CustomBarListProps } from "./Tremor_Custom";
import { CustomBarList, CustomDonutChart, CustomSmallTextCard, CustomAreaChart, CustomBarChart } from "./Tremor_Custom";

interface DemographicsTabProps {
	hackerData: Prisma.HackerInfoGetPayload<true>[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getNumberPerValue = (data: { name: string; value: number; title: string }[]) => {
	const valueSet = new Set<string>();
	data.forEach(datum => valueSet.add(datum.name));
	const values = Array.from(valueSet);

	const valueData: { name: string; value: number; title: string }[] = [];

	values.forEach(cat => valueData.push({ name: cat, value: 0, title: cat }));

	data.forEach(datum => {
		const catDatum = valueData.filter(valueDatum => valueDatum.name === datum.name)[0];
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		catDatum!.value++;
	});

	return valueData;
};

export default function DemographicsTab(props: DemographicsTabProps) {
	const { hackerData } = props;
	const demographicsKeysSet = new Set<string>();
	hackerData.forEach(hacker => {
		Object.keys(hacker).forEach(key => demographicsKeysSet.add(key));
	});
	const demographicsKeys = Array.from(demographicsKeysSet);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const metricsData: { [key: string]: { title: string; value: any; name: string }[] } = {};
	demographicsKeys.forEach(key => (metricsData[key] = []));

	hackerData.forEach(hacker => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
		demographicsKeys.forEach(key => metricsData[key]!.push({ title: key, value: hacker[key], name: hacker[key] }));
	});

	const aggregatedMetricsData: { [key: string]: { name: string; value: number; title: string }[] } = {};
	demographicsKeys.forEach(key => (aggregatedMetricsData[key] = getNumberPerValue(metricsData[key]!)));

	return (
		<main className="mx-auto max-w-7xl p-4 md:p-10">
			<Grid numItems={1} className="gap-6">
				<Select>
					<SelectItem value="1">All Applications</SelectItem>
					<SelectItem value="3">Group - Selected_Online</SelectItem>
					<SelectItem value="3">Group - Selected_InPerson_uOttawa</SelectItem>
					<SelectItem value="2">Accepted</SelectItem>
					<SelectItem value="3">Confirmed Attending</SelectItem>
				</Select>
				<Grid numItemsSm={3} numItemsLg={4} className="gap-6">
					<CustomSmallTextCard title="Total Applications" metric={2000} text={"Hackers"} />
					<CustomSmallTextCard title="English / French" metric={"715 / 1200"} text={"Hackers"} />
					<CustomSmallTextCard title="Est. Event Capacity" metric={"715"} text={"Spots"} />
					<CustomSmallTextCard title="Hackers in Group" metric={"2000"} text={"Selected"} />
				</Grid>

				<Grid numItemsSm={1} numItemsLg={3} className="gap-6">
					<Card>
						<CustomDonutChart title="Languages" data={aggregatedMetricsData.preferredLanguage!} />
					</Card>
					<Card>
						<CustomDonutChart title="Transport" data={aggregatedMetricsData.transportationRequired!} />
					</Card>
					<Card>
						<CustomDonutChart title="Preferred Pronouns" data={aggregatedMetricsData.gender!} />
					</Card>
					<Card>
						<CustomBarList
							title="Top Levels of Study"
							data={aggregatedMetricsData.studyLevel as CustomBarListProps["data"]}
							limitEntries={5}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Top Applying Schools"
							data={aggregatedMetricsData.university as CustomBarListProps["data"]}
							limitEntries={5}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Top Applying Programs"
							data={aggregatedMetricsData.studyProgram as CustomBarListProps["data"]}
							limitEntries={5}
						/>
					</Card>

					<Card>
						<CustomBarChart title="Graduating Years" data={aggregatedMetricsData.graduationYear!} />
					</Card>
					<Card>
						<CustomBarList
							title="Dietary Restrictions"
							data={aggregatedMetricsData.dietaryRestrictions as CustomBarListProps["data"]}
						/>
					</Card>
					<Card>
						<CustomDonutChart title="T-Shirt Sizes" data={aggregatedMetricsData.shirtSize!} />
					</Card>
				</Grid>
				<Card>
					<CustomAreaChart title="Application Status" data={aggregatedMetricsData.confirmed!} />
				</Card>
			</Grid>
		</main>
	);
}
