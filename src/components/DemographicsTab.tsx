"use client";

import { Card, Grid, Select, SelectItem } from "@tremor/react";
import { CustomBarList, CustomDonutChart, CustomSmallTextCard, CustomAreaChart, CustomBarChart } from "./Tremor_Custom";

const attendeesState = [
	{
		title: "Not reviewed",
		value: 100,
	},
	{
		title: "Not Invited",
		value: 700,
	},
	{
		title: "Invited: Response Pending",
		value: 300,
	},

	{
		title: "Invited: Confirmed",
		value: 672,
	},
	{
		title: "Invited: Denied",
		value: 50,
	},
	{
		title: "Invited: Expired",
		value: 50,
	},
];

const Transport = [
	{
		title: "Inside Ottawa",
		value: 100,
	},
	{
		title: "Outside Ottawa - Require Transport",
		value: 700,
	},
	{
		title: "Outside Ottawa - No Transport",
		value: 300,
	},
	{
		title: "Online",
		value: 300,
	},
];

const PreferedPronouns = [
	{
		title: "She/Her",
		value: 100,
	},
	{
		title: "He/Him",
		value: 700,
	},
	{
		title: "They/Them",
		value: 300,
	},
	{
		title: "Prefer Not to Answer",
		value: 300,
	},
];

const toplevels = [
	{ name: "University", value: 900 },
	{ name: "Bootcamp / Code School", value: 676 },
	{ name: "College", value: 200 },
	{ name: "Not currently a student", value: 100 },
	{ name: "Other", value: 191 },
];

const topApplyingSchools = [
	{ name: "uOttawa", value: 789 },
	{ name: "Carleton", value: 676 },
	{ name: "Waterloo", value: 564 },
	{ name: "Queens", value: 234 },
	{ name: "u of T", value: 191 },
	{ name: "Western", value: 100 },
];
const topApplyingPrograms = [
	{ name: "Computer Engineering", value: 500 },
	{ name: "Computer Science", value: 400 },
	{ name: "Software Engineering", value: 123 },
	{ name: "Electrical Engineering", value: 333 },
	{ name: "Mathematics", value: 20 },
];

const graduatingYears = [
	{ title: "2022", "Number graduating": 500 },
	{ title: "2023", "Number graduating": 400 },
	{ title: "2024", "Number graduating": 123 },
	{ title: "2025", "Number graduating": 333 },
	{ title: "2026", "Number graduating": 20 },
];

const tshirtsize = [
	{ title: "S", value: 360 },
	{ title: "M", value: 200 },
	{ title: "X", value: 123 },
	{ title: "XL", value: 333 },
];

const FoodRestrictions = [
	{ name: "Halal", value: 360 },
	{ name: "Lactose", value: 200 },
	{ name: "Gluten", value: 123 },
	{ name: "Vegan", value: 333 },
	{ name: "Vegan2", value: 2 },
	{ name: "Vegan3", value: 3 },
	{ name: "Vegan4", value: 10 },
];

const regData = [
	{
		title: "Dec 2, 2023",
		"New Applications": 100,
		"Acceptances Sent": 0,
		"RSVP Confirmed": 0,
		"RSVP Denied": 0,
		"RSVP Expired": 0,
	},
	{
		title: "Dec 20, 2023",
		"New Applications": 360,
		"Acceptances Sent": 600,
		"RSVP Confirmed": 420,
		"RSVP Denied": 20,
		"RSVP Expired": 1,
	},
	{
		title: "January 2, 2023",
		"New Applications": 0,
		"Acceptances Sent": 360,
		"RSVP Confirmed": 360,
		"RSVP Denied": 70,
		"RSVP Expired": 50,
	},

	{
		title: "February 2, 2023",
		"New Applications": 0,
		"Acceptances Sent": 0,
		"RSVP Confirmed": 200,
		"RSVP Denied": 10,
		"RSVP Expired": 1000,
	},
];

export default function DemographicsTab() {
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
						<CustomDonutChart title="Applications / RSVP" data={attendeesState} />
					</Card>
					<Card>
						<CustomDonutChart title="Transport" data={Transport} />
					</Card>
					<Card>
						<CustomDonutChart title="Preferred Pronouns" data={PreferedPronouns} />
					</Card>
					<Card>
						<CustomBarList title="Top Levels of Study" data={toplevels} limitEntries={5} />
					</Card>
					<Card>
						<CustomBarList title="Top Applying Schools" data={topApplyingSchools} limitEntries={5} />
					</Card>
					<Card>
						<CustomBarList title="Top Applying Programs" data={topApplyingPrograms} limitEntries={5} />
					</Card>

					<Card>
						<CustomBarChart title="Graduating Years" data={graduatingYears} />
					</Card>
					<Card>
						<CustomBarList title="Dietary Restrictions" data={FoodRestrictions} />
					</Card>
					<Card>
						<CustomDonutChart title="T-Shirt Sizes" data={tshirtsize} />
					</Card>
				</Grid>
				<Card>
					<CustomAreaChart title="Application Status" data={regData} />
				</Card>
			</Grid>
		</main>
	);
}
