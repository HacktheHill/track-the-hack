/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { type Prisma } from "@prisma/client";

import { Card, Grid, Select, SelectItem } from "@tremor/react";
import type { CustomBarListProps } from "./Tremor_Custom";
import { CustomBarList, CustomDonutChart, CustomSmallTextCard, CustomAreaChart, CustomBarChart } from "./Tremor_Custom";
import type { typeStrKeyNumVal, typeStrKeyAnyVal } from "../utils/types";

interface DemographicsTabProps {
	hackerData: Prisma.HackerInfoGetPayload<true>[];
}

const valToStr = (val: boolean | string | undefined) => {
	return val === true || val === false ? (val ? "Yes" : "No") : val ? val.toString() : "";
};

const getUniqueValuesFromData = (data: { name: string; value: number; title: string }[]) => {
	const valueSet = new Set<string>();
	data.forEach(datum => {
		if (datum.name !== undefined && datum.name !== null && datum.name !== "") {
			valueSet.add(datum.name);
		}
	});
	return Array.from(valueSet).sort();
};

const getNumberPerValue = (data: { name: string; value: number; title: string }[]) => {
	const valueData: { name: string; value: number; title: string }[] = [];
	const values = getUniqueValuesFromData(data);

	values.forEach(val => valueData.push({ name: valToStr(val), value: 0, title: valToStr(val) }));

	data.forEach(datum => {
		const valueDatum = valueData.filter(valueDatum => valToStr(valueDatum.name) === valToStr(datum.name))[0];

		if (valueDatum) {
			valueDatum.value++;
		}
	});

	return valueData;
};

const getNumberPerValueBarChart = (
	data: { name: string; value: number; title: string }[],
	getKeyName: (key: string) => string,
) => {
	const values = getUniqueValuesFromData(data);
	const valueData: (typeStrKeyNumVal & { title: string })[] = [];

	values.forEach(val => {
		if (val) {
			valueData.push({ [getKeyName(val)]: 0, title: valToStr(val) } as typeStrKeyNumVal & { title: string });
		}
	});

	data.forEach(datum => {
		const valueDatum = valueData.filter(valueDatum => valueDatum.title === valToStr(datum.name))[0];

		if (valueDatum) {
			valueDatum[getKeyName(valToStr(datum.name))]++;
		}
	});

	return valueData;
};

const getNumberPerValueAreaChart = (data: { name: string; value: number; title: string }[]) => {
	const values = getUniqueValuesFromData(data);
	const valueData: (typeStrKeyNumVal & { date: string })[] = [];

	values.forEach(val => {
		if (val) {
			valueData.push({ [valToStr(val)]: 0, date: "" } as typeStrKeyNumVal & { date: string });
		}
	});

	data.forEach(datum => {
		const valueDatum = valueData.filter(
			valueDatum => valToStr(Object.keys(valueDatum).filter(key => key !== "date")[0]) === valToStr(datum.name),
		)[0];

		if (valueDatum) {
			valueDatum[valToStr(datum.name)]++;
		}
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

	hackerData.forEach((hacker: typeStrKeyAnyVal) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
		demographicsKeys.forEach(key => metricsData[key]!.push({ title: key, value: hacker[key], name: hacker[key] }));
	});

	const aggregatedMetricsData: {
		[key: string]: (typeStrKeyAnyVal & { name?: string; value?: number; title?: string })[];
	} = {};
	demographicsKeys.forEach(key => {
		const barChartKeys = ["graduationYear"];
		const areaChartKeys = ["confirmed"];
		const getBarChartKeyName = (key: string) => {
			switch (key) {
				case "graduationYear":
					return (keyName: string) => `Graduates in ${keyName}`;
			}
		};

		const aggregateFunc = !barChartKeys.concat(areaChartKeys).includes(key)
			? getNumberPerValue
			: barChartKeys.includes(key)
			? (metricData: { title: string; value: any; name: string }[]) =>
					getNumberPerValueBarChart(metricData, getBarChartKeyName(key) as (key: string) => string)
			: getNumberPerValueAreaChart;
		aggregatedMetricsData[key] = aggregateFunc(metricsData[key]!);
	});

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
						<CustomDonutChart
							title="Languages"
							data={aggregatedMetricsData.preferredLanguage! as ReturnType<typeof getNumberPerValue>}
						/>
					</Card>
					<Card>
						<CustomDonutChart
							title="Transport Required"
							data={aggregatedMetricsData.transportationRequired! as ReturnType<typeof getNumberPerValue>}
						/>
					</Card>
					<Card>
						<CustomDonutChart
							title="Preferred Pronouns"
							data={aggregatedMetricsData.gender! as ReturnType<typeof getNumberPerValue>}
						/>
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
						<CustomBarChart
							title="Graduating Years"
							data={aggregatedMetricsData.graduationYear! as ReturnType<typeof getNumberPerValueBarChart>}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Dietary Restrictions"
							data={aggregatedMetricsData.dietaryRestrictions as CustomBarListProps["data"]}
						/>
					</Card>
					<Card>
						<CustomDonutChart
							title="T-Shirt Sizes"
							data={aggregatedMetricsData.shirtSize! as ReturnType<typeof getNumberPerValue>}
						/>
					</Card>
				</Grid>
				<Card>
					{/* TODO: Need application date data to complete */}
					<CustomAreaChart
						title="Application Confirmed"
						data={aggregatedMetricsData.confirmed! as ReturnType<typeof getNumberPerValueAreaChart>}
					/>
				</Card>
			</Grid>
		</main>
	);
}
