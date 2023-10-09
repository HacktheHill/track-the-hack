/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Card, Grid, Select, SelectItem } from "@tremor/react";
import type { CustomBarListProps } from "./Tremor_Custom";
import { CustomBarList, CustomDonutChart, CustomSmallTextCard, CustomAreaChart, CustomBarChart } from "./Tremor_Custom";
import { type AggregatedHackerInfo } from "../utils/types";

interface DemographicsTabProps {
	aggregatedHackerData: AggregatedHackerInfo;
}

export default function DemographicsTab(props: DemographicsTabProps) {
	const { aggregatedHackerData } = props;
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
							data={aggregatedHackerData.preferredLanguage! as ReturnType<typeof getNumberPerValue>}
						/>
					</Card>
					<Card>
						<CustomDonutChart
							title="Transport Required"
							data={aggregatedHackerData.transportationRequired! as ReturnType<typeof getNumberPerValue>}
						/>
					</Card>
					<Card>
						<CustomDonutChart
							title="Preferred Pronouns"
							data={aggregatedHackerData.gender! as ReturnType<typeof getNumberPerValue>}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Top Levels of Study"
							data={aggregatedHackerData.studyLevel as CustomBarListProps["data"]}
							limitEntries={5}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Top Applying Schools"
							data={aggregatedHackerData.university as CustomBarListProps["data"]}
							limitEntries={5}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Top Applying Programs"
							data={aggregatedHackerData.studyProgram as CustomBarListProps["data"]}
							limitEntries={5}
						/>
					</Card>

					<Card>
						<CustomBarChart
							title="Graduating Years"
							data={aggregatedHackerData.graduationYear! as ReturnType<typeof getNumberPerValueBarChart>}
						/>
					</Card>
					<Card>
						<CustomBarList
							title="Dietary Restrictions"
							data={aggregatedHackerData.dietaryRestrictions as CustomBarListProps["data"]}
						/>
					</Card>
					<Card>
						<CustomDonutChart
							title="T-Shirt Sizes"
							data={aggregatedHackerData.shirtSize! as ReturnType<typeof getNumberPerValue>}
						/>
					</Card>
				</Grid>
				<Card>
					{/* TODO: Need application date data to complete */}
					<CustomAreaChart
						title="Application Confirmed"
						data={aggregatedHackerData.confirmed! as ReturnType<typeof getNumberPerValueAreaChart>}
					/>
				</Card>
			</Grid>
		</main>
	);
}
