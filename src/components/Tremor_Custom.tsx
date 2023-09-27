import React from "react";
import {
	Card,
	Metric,
	Text,
	Title,
	BarList,
	Flex,
	Grid,
	DonutChart,
	Legend,
	BarChart,
	Table,
	Badge,
	TableHead,
	TableHeaderCell,
	TableBody,
	TableRow,
	TableCell,
	CategoryBar,
	Divider,
	AreaChart,
} from "@tremor/react";

type TremorDefaultColors = (
	| "green"
	| "red"
	| "blue"
	| "orange"
	| "purple"
	| "gray"
	| "lime"
	| "rose"
	| "sky"
	| "yellow"
	| "indigo"
)[];
const defaultColors: TremorDefaultColors = [
	"green",
	"red",
	"blue",
	"orange",
	"purple",
	"gray",
	"lime",
	"rose",
	"sky",
	"yellow",
	"indigo",
];

interface GetCategoriesFromDataProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: { title: string; [key: string]: any }[];
}

const getCategoriesFromData = (data: GetCategoriesFromDataProps["data"]) => {
	// Get the categories
	const allKeys = data.reduce((acc, item) => {
		Object.keys(item).forEach(key => {
			acc.add(key);
		});
		return acc;
	}, new Set<string>());

	allKeys.delete("title");

	// Convert the Set to an array
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
			<DonutChart className="mt-6" data={data} category="value" index="title" colors={defaultColors} />
			<Legend className="mt-3" categories={categories} colors={defaultColors} />
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

const CustomSmallTextCard: React.FC<CustomSmallTextCardProps> = ({
	title,
	metric = "UKN", // Default value if metric is not provided
	text = "", // Default value if text is not provided
}) => {
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

interface EventsTableProps {
	title: string;
	data: { title: string; state: boolean; utilization: number }[];
}

const EventsTable: React.FC<EventsTableProps> = ({ title, data }) => {
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
							<TableCell>{item.title}</TableCell>
							<TableCell>
								<Text>
									{" "}
									<Badge color={item.state ? "green" : "red"}>{item.state ? "Open" : "Closed"}</Badge>
								</Text>
							</TableCell>
							<TableCell>{item.utilization}%</TableCell>
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: { title: string; [key: string]: any }[];
}

const CustomAreaChart: React.FC<CustomAreaChartProps> = ({ title, data }) => {
	const categories = getCategoriesFromData(data);

	return (
		<>
			<Title>{title}</Title>
			<Divider />

			<AreaChart
				className="mt-4 h-80"
				data={data}
				categories={categories}
				index="title"
				colors={defaultColors}
				yAxisWidth={60}
			/>
		</>
	);
};

interface CustomBarChartProps {
	title: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: { title: string; [key: string]: any }[];
}

const CustomBarChart: React.FC<CustomBarChartProps> = ({ title, data }) => {
	const categories = getCategoriesFromData(data);

	return (
		<>
			<Title>{title}</Title>
			<Divider />

			<BarChart
				className="mt-6"
				data={data}
				index="title"
				categories={categories}
				colors={defaultColors}
				yAxisWidth={48}
			/>
		</>
	);
};

export {
	CustomDonutChart,
	CustomSmallTextCard,
	EventsTable,
	InventoryTable,
	CustomBarList,
	CustomAreaChart,
	CustomBarChart,
};
export type { CustomBarListProps };
