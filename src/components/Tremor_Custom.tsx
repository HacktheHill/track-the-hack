import {
	AreaChart,
	Badge,
	BarChart,
	BarList,
	Card,
	CategoryBar,
	Divider,
	DonutChart,
	Flex,
	Grid,
	Legend,
	Metric,
	Select,
	SelectItem,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeaderCell,
	TableRow,
	Text,
	Title,
} from "@tremor/react";
import React, { useState } from "react";
import { valToStr } from "../client/getAggregatedData";
import type { StrKeyAnyVal, StrKeyNumVal, TremorChartData } from "../client/types";

type TremorDefaultColors = ("green" | "red" | "sky" | "fuchsia" | "lime" | "violet" | "yellow" | "indigo" | "orange")[];
// green and red must be first and second so the "true" values are green and the "false" ones are red in the data charts
const defaultColors: TremorDefaultColors = [
	"green",
	"red",
	"sky",
	"fuchsia",
	"lime",
	"violet",
	"yellow",
	"indigo",
	"orange",
];

const getDefaultColors = (categories: string[]) => {
	// first colour is red if there is no "true" category
	if (categories.length === 1 && categories[0] === valToStr(false)) {
		return defaultColors.slice(1);
	} else {
		return defaultColors;
	}
};

interface GetCategoriesFromDataProps {
	data: ({ title?: string } & StrKeyAnyVal)[];
}

const getCategoriesFromData = (data: GetCategoriesFromDataProps["data"], isLikeBarChart = false) => {
	const allKeys = data.reduce((acc, item) => {
		Object.keys(item).forEach(key => {
			acc.add(key);
		});
		return acc;
	}, new Set<string>());

	allKeys.delete("title");

	if (isLikeBarChart) {
		allKeys.delete("name");
		allKeys.delete("value");
	}

	const keysNotTitle = Array.from(allKeys);

	return keysNotTitle;
};

interface CustomDonutChartProps {
	title: string;
	data: { title: string; value: number }[];
}

const CustomDonutChart: React.FC<CustomDonutChartProps> = ({ title, data }) => {
	const categories = data.map(item => item.title);

	return (
		<div>
			<Title>{title}</Title>
			<DonutChart
				className="mt-6"
				data={data}
				category="value"
				index="title"
				colors={getDefaultColors(categories)}
			/>
			<Legend className="mt-3" categories={categories} colors={getDefaultColors(categories)} />
		</div>
	);
};

interface CustomBarListProps {
	title: string;
	data: { name: string; value: number }[];
	limitEntries?: number;
}

const CustomBarList: React.FC<CustomBarListProps> = ({ title, data, limitEntries = 0 }) => {
	data.sort((a, b) => b.value - a.value);

	return (
		<div>
			<Title>{title}</Title>
			<BarList
				data={limitEntries > 0 ? data.slice(0, limitEntries) : data}
				showAnimation={true}
				className="mt-2"
			/>
		</div>
	);
};

interface CustomSmallTextCardProps {
	title: string;
	metric?: string | number;
	text?: string | number;
}

const CustomSmallTextCard: React.FC<CustomSmallTextCardProps> = ({ title, metric = "UKN", text = "" }) => {
	return (
		<Card>
			<Title>{title}</Title>
			<Flex justifyContent="start" alignItems="baseline" className="space-x-2">
				<Metric>{metric}</Metric>
				<Text>{text}</Text>
			</Flex>
		</Card>
	);
};

interface MultiCheckInEventsChartProps {
	title: string;
	data: { [key: string]: TremorChartData };
	selectKeys: string[];
	eventKeyToLabel: { [key: string]: string };
}

const MultiCheckInEventsChart: React.FC<MultiCheckInEventsChartProps> = ({
	title,
	data,
	selectKeys,
	eventKeyToLabel,
}) => {
	const [selectedKey, setSelectedKey] = useState(Object.keys(eventKeyToLabel)[0]);
	const handleOnChange = (value: string) => {
		setSelectedKey(value);
	};
	return (
		<>
			<CustomDonutChart
				title={title}
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				data={selectedKey ? data[selectedKey]! : data[selectKeys[0]!]!}
			></CustomDonutChart>
			<Select value={selectedKey} onValueChange={handleOnChange}>
				{selectKeys.map((eventKey, idx) => (
					<SelectItem value={eventKey} key={idx.toString()}>
						{eventKeyToLabel[eventKey]}
					</SelectItem>
				))}
			</Select>
		</>
	);
};

interface EventsTableProps {
	title: string;
	data: { title: string; state: boolean; utilization: number }[];
	eventKeyToLabel: { [key: string]: string };
}

const EventsTable: React.FC<EventsTableProps> = ({ title, data, eventKeyToLabel }) => {
	return (
		<>
			<Title>{title}</Title>
			<Divider />
			<Table className="mt-5">
				<TableHead>
					<TableRow>
						<TableHeaderCell>Name</TableHeaderCell>
						<TableHeaderCell>Status</TableHeaderCell>
						<TableHeaderCell>Percentage Utilization</TableHeaderCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{data.map(item => (
						<TableRow key={item.title}>
							<TableCell>{eventKeyToLabel[item.title]}</TableCell>
							<TableCell>
								<Text>
									{" "}
									<Badge color={item.state ? "green" : "red"}>{item.state ? "Open" : "Closed"}</Badge>
								</Text>
							</TableCell>
							<TableCell>{Math.round(item.utilization * 1000) / 1000}%</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</>
	);
};

interface InventoryTableProps {
	title: string;
	data: { title: string; distributed: number; forecasted: number; unallocated: number }[];
}

const InventoryTable: React.FC<InventoryTableProps> = ({ title, data }) => {
	return (
		<>
			<Title>{title}</Title>
			<Divider />

			<Grid numItemsSm={1} numItemsLg={2} className="gap-6">
				{data.map(item => (
					<div key={item.title}>
						<Flex>
							<Title>
								{item.title} - {item.forecasted + item.unallocated} Remaining
							</Title>
						</Flex>
						<CategoryBar
							values={[item.distributed, item.forecasted, item.unallocated]}
							colors={["red", "yellow", "green"]}
							className="mt-3"
						/>
					</div>
				))}
			</Grid>
			<Legend
				className="mt-3"
				categories={["Disturbed", "Forecasted", "Unallocated"]}
				colors={["red", "yellow", "green"]}
			/>
		</>
	);
};

interface CustomAreaChartProps {
	title: string;
	data: (StrKeyAnyVal & { title: string })[];
}

const CustomAreaChart: React.FC<CustomAreaChartProps> = ({ title, data }) => {
	const categories = getCategoriesFromData(data, true);

	return (
		<>
			<Title>{title}</Title>
			<Divider />

			<AreaChart
				className="mt-4 h-80"
				data={data}
				categories={categories}
				index="title"
				colors={getDefaultColors(categories)}
				yAxisWidth={60}
			/>
		</>
	);
};

interface CustomBarChartProps {
	title: string;
	data: (StrKeyNumVal & { title: string })[];
}

const CustomBarChart: React.FC<CustomBarChartProps> = ({ title, data }) => {
	const categories = getCategoriesFromData(data, true);

	return (
		<>
			<Title>{title}</Title>
			<Divider />

			<BarChart
				className="mt-6"
				data={data}
				index="name"
				categories={categories}
				colors={getDefaultColors(categories)}
				yAxisWidth={48}
			/>
		</>
	);
};

export {
	CustomAreaChart,
	CustomBarChart,
	CustomBarList,
	CustomDonutChart,
	CustomSmallTextCard,
	EventsTable,
	InventoryTable,
	MultiCheckInEventsChart,
};
export type { CustomBarListProps };
