import type { TremorChartData, StrKeyAnyVal, StrKeyNumVal } from "./types";
import { type Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const valToStr = (val: any): string => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
	return val === true || val === false ? (val ? "Yes" : "No") : val ? val.toString() : "";
};

const getUniqueValuesFromData = (data: TremorChartData) => {
	const valueSet = new Set<string>();
	data.forEach(datum => {
		if (datum.name !== undefined && datum.name !== null && datum.name !== "") {
			valueSet.add(datum.name);
		}
	});
	return Array.from(valueSet).sort();
};

export const getNumberPerValue = (data: TremorChartData) => {
	const valueData: TremorChartData = [];
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

export const getNumberPerValueBarChart = (data: TremorChartData, getKeyName: (key: string) => string) => {
	const values = getUniqueValuesFromData(data);
	const valueData: (StrKeyNumVal & { title: string })[] = [];

	values.forEach(val => {
		if (val) {
			valueData.push({ [getKeyName(val)]: 0, title: valToStr(val) } as StrKeyNumVal & { title: string });
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

export const getNumberPerValueAreaChart = (data: TremorChartData) => {
	const values = getUniqueValuesFromData(data);
	const valueData: (StrKeyNumVal & { date: string })[] = [];

	values.forEach(val => {
		if (val) {
			valueData.push({ [valToStr(val)]: 0, date: "" } as StrKeyNumVal & { date: string });
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

export const getAggregatedHackerInfo = (
	hackerData: StrKeyAnyVal[],
	filterKey?: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	filterVal?: any,
) => {
	const filteredHackerData =
		!!filterKey && !!filterVal
			? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			  hackerData.filter(hacker => valToStr(hacker[filterKey]!) === valToStr(filterVal))
			: hackerData;

	const demographicsKeysSet = new Set<string>();
	filteredHackerData.forEach(hacker => {
		Object.keys(hacker).forEach(key => demographicsKeysSet.add(key));
	});
	const demographicsKeys = Array.from(demographicsKeysSet);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const metricsData: { [key: string]: { title: string; value: any; name: string }[] } = {};
	demographicsKeys.forEach(key => (metricsData[key] = []));

	filteredHackerData.forEach((hacker: StrKeyAnyVal) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion
		demographicsKeys.forEach(key => metricsData[key]!.push({ title: key, value: hacker[key], name: hacker[key] }));
	});

	const aggregatedHackerInfo: {
		[key: string]: (StrKeyAnyVal & { name?: string; value?: number; title?: string })[];
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
			? // eslint-disable-next-line @typescript-eslint/no-explicit-any
			  (metricData: { title: string; value: any; name: string }[]) =>
					getNumberPerValueBarChart(metricData, getBarChartKeyName(key) as (key: string) => string)
			: getNumberPerValueAreaChart;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		aggregatedHackerInfo[key] = aggregateFunc(metricsData[key]!);
	});

	return aggregatedHackerInfo;
};

export const getAggregatedPresenceInfo = (presenceData: Prisma.PresenceInfoGetPayload<true>[]) => {
	const presenceKeysSet = new Set<string>();
	presenceData.forEach(presenceDatum => {
		Object.keys(presenceDatum).forEach(key => presenceKeysSet.add(key));
	});
	const presenceKeys = Array.from(presenceKeysSet);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const metricsData: { [key: string]: { title: string; value: any; name: string }[] } = {};
	presenceKeys.forEach(key => (metricsData[key] = []));

	presenceData.forEach((presenceDatum: StrKeyAnyVal) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
		presenceKeys.forEach(key =>
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			metricsData[key]?.push({ title: key, value: presenceDatum[key], name: presenceDatum[key] }),
		);
	});

	const aggregatedPresenceData: {
		[key: string]: TremorChartData;
	} = {};

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	presenceKeysSet.forEach(key => (aggregatedPresenceData[key] = getNumberPerValue(metricsData[key]!)));

	return aggregatedPresenceData;
};
