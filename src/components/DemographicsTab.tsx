import { type HackerInfo } from "@prisma/client";
import { Card, Grid, Select, SelectItem } from "@tremor/react";
import { useEffect, useState } from "react";
import {
	getAggregatedHackerInfo,
	getNumberPerValueAreaChart,
	getNumberPerValueBarChart,
	valToStr,
} from "../utils/getAggregatedData";
import { type AggregatedHackerInfo, type HackerInfoKey } from "../utils/types";
import { CustomAreaChart, CustomBarChart, CustomBarList, CustomDonutChart, CustomSmallTextCard } from "./Tremor_Custom";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filterHackerData = (filterKey: HackerInfoKey, filterVal: any, hackerData: HackerInfo[]) => {
	return hackerData.filter(hacker => valToStr(hacker[filterKey]) === valToStr(filterVal));
};

// TODO: implement the rest of the application types once they are in the db
const getFilteredHackerData = (applicationType: string, hackerData: HackerInfo[]) => {
	switch (applicationType) {
		case "all":
			return hackerData;
		case "confirmed":
			return getConfirmedHackerData(hackerData);
		default:
			return hackerData;
	}
};

const getConfirmedHackerData = (hackerData: HackerInfo[]) => {
	return filterHackerData("confirmed", valToStr(true), hackerData);
};

interface DemographicsTabProps {
	aggregatedHackerData: AggregatedHackerInfo;
	hackerData: HackerInfo[];
}

export default function DemographicsTab(props: DemographicsTabProps) {
	const { aggregatedHackerData, hackerData } = props;
	const [selectedKey, setSelectedKey] = useState("all");
	const [filteredHackerData, setFilteredHackerData] = useState(hackerData);
	const [filteredAggregatedHackerData, setFilteredAggregatedHackerInfo] = useState(aggregatedHackerData);

	useEffect(() => {
		const newFilteredHackerData = getFilteredHackerData(selectedKey, hackerData);
		setFilteredHackerData(newFilteredHackerData);
		setFilteredAggregatedHackerInfo(getAggregatedHackerInfo(newFilteredHackerData));
	}, [hackerData, selectedKey]);

	const handleOnSelectChange = (key: string) => {
		setSelectedKey(key);
		setFilteredHackerData(getFilteredHackerData(key, hackerData));
		setFilteredAggregatedHackerInfo(getDataByAppType(key));
	};

	const getDataByAppType = (applicationType: string) => {
		return getAggregatedHackerInfo(getFilteredHackerData(applicationType, hackerData));
	};

	const getNumberOfFilteredHackers = () => {
		switch (selectedKey) {
			case "all":
				return hackerData.length;
			case "confirmed":
				return getConfirmedHackerData(hackerData).length;
			default:
				return hackerData.length;
		}
	};

	const getNumFilteredAppsByValue = (key: HackerInfoKey, value: string | number): number => {
		return filteredHackerData.filter(hackerDatum => valToStr(hackerDatum[key]) === valToStr(value)).length;
	};

	return (
		<main className="mx-auto max-w-7xl p-4 md:p-10">
			<Grid numItems={1} className="gap-6">
				<Select value={selectedKey} onValueChange={handleOnSelectChange}>
					<SelectItem value="all">All Applications</SelectItem>
					<SelectItem value="selected_online">Group - Selected_Online</SelectItem>
					<SelectItem value="selected_inperson">Group - Selected_InPerson_uOttawa</SelectItem>
					<SelectItem value="accepted">Accepted</SelectItem>
					<SelectItem value="confirmed">Confirmed Attending</SelectItem>
				</Select>
				<Grid numItemsSm={3} numItemsLg={4} className="gap-6">
					<CustomSmallTextCard title="Total Applications" metric={hackerData.length} text={"Hackers"} />
					<CustomSmallTextCard
						title="English / French"
						metric={`${getNumFilteredAppsByValue("preferredLanguage", "EN")} / ${getNumFilteredAppsByValue(
							"preferredLanguage",
							"FR",
						)}`}
						text={"Hackers in Group"}
					/>
					{/* TODO: update event capacity with actual value */}
					<CustomSmallTextCard title="Est. Event Capacity" metric={"715"} text={"Spots"} />
					<CustomSmallTextCard
						title="Hackers in Group"
						metric={getNumberOfFilteredHackers()}
						text={"Selected"}
					/>
				</Grid>

				<Grid numItemsSm={1} numItemsLg={3} className="gap-6">
					<Card>
						<CustomDonutChart title="Languages" data={filteredAggregatedHackerData.preferredLanguage} />
					</Card>
					<Card>
						<CustomDonutChart
							title="Transport Required"
							data={filteredAggregatedHackerData.transportationRequired}
						/>
					</Card>
					<Card>
						<CustomDonutChart title="Preferred Pronouns" data={filteredAggregatedHackerData.gender} />
					</Card>
					<Card>
						<CustomBarList
							title="Top Levels of Study"
							data={filteredAggregatedHackerData.studyLevel}
							limitEntries={5}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Top Applying Schools"
							data={filteredAggregatedHackerData.university}
							limitEntries={5}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Top Applying Programs"
							data={filteredAggregatedHackerData.studyProgram}
							limitEntries={5}
						/>
					</Card>

					<Card>
						<CustomBarChart
							title="Graduating Years"
							data={getNumberPerValueBarChart(
								// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
								filteredAggregatedHackerData.graduationYear,
								(keyName: string) => `Graduates in ${keyName}`,
							)}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Dietary Restrictions"
							data={filteredAggregatedHackerData.dietaryRestrictions}
						/>
					</Card>
					<Card>
						<CustomDonutChart title="T-Shirt Sizes" data={filteredAggregatedHackerData.shirtSize} />
					</Card>
				</Grid>
				<Card>
					{/* TODO: Need application date data to complete */}
					<CustomAreaChart
						title="Application Confirmed"
						data={getNumberPerValueAreaChart(filteredAggregatedHackerData.confirmed)}
					/>
				</Card>
			</Grid>
		</main>
	);
}
