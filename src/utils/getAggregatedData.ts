import type {
	TremorChartData,
	StrKeyAnyVal,
	StrKeyNumVal,
	AggregatedPresenceInfo,
	AggregatedHackerInfo,
} from "./types";
import { type Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const valToStr = (val: any): string => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
	return typeof val === "boolean" ? (val ? "Yes" : "No") : val ? val.toString() : "";
};

const getUniqueValuesFromData = (data: TremorChartData) => {
	const valueSet = new Set<string>();
	data.forEach(datum => {
		if (datum.name) {
			valueSet.add(datum.name);
		}
	});

	const values = Array.from(valueSet).sort();
	return values;
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
			valueDatum[getKeyName(valToStr(datum.name))] = datum.value;
		}
	});

	return valueData;
};

export const getNumberPerValueAreaChart = (data: TremorChartData) => {
	const values = getUniqueValuesFromData(data);
	const valueData: (StrKeyNumVal & { title: string })[] = [];

	values.forEach(val => {
		if (val) {
			// TODO: "title" should be the date of the application confirmation
			valueData.push({ [valToStr(val)]: 0, title: "" } as StrKeyNumVal & { title: string });
		}
	});

	data.forEach(datum => {
		const valueDatum = valueData.filter(
			valueDatum => valToStr(Object.keys(valueDatum).filter(key => key !== "title")[0]) === valToStr(datum.name),
		)[0];

		if (valueDatum) {
			valueDatum[valToStr(datum.name)] = datum.value;
		}
	});

	return valueData;
};

export const getMetricsKeysAndData = (data: StrKeyAnyVal[]) => {
	const metricsKeysSet = new Set<string>();
	data.forEach(datum => {
		Object.keys(datum).forEach(key => metricsKeysSet.add(key));
	});
	const metricsKeys = Array.from(metricsKeysSet);

	const metricsData: AggregatedPresenceInfo = {};
	metricsKeys.forEach(key => (metricsData[key] = []));

	data.forEach((datum: StrKeyAnyVal) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion
		metricsKeys.forEach(key => metricsData[key]!.push({ title: key, value: 0, name: valToStr(datum[key]) }));
	});

	return { metricsKeys, metricsData };
};

export const getAggregatedHackerInfo = (hackerData: StrKeyAnyVal[]) => {
	const aggregatedHackerInfo: AggregatedHackerInfo = {};
	const { metricsKeys, metricsData } = getMetricsKeysAndData(hackerData);

	metricsKeys.forEach(key => {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		aggregatedHackerInfo[key] = getNumberPerValue(metricsData[key]!);
	});

	return aggregatedHackerInfo;
};

export const getAggregatedPresenceInfo = (presenceData: Prisma.PresenceInfoGetPayload<true>[]) => {
	const { metricsKeys, metricsData } = getMetricsKeysAndData(presenceData);

	const aggregatedPresenceData: AggregatedPresenceInfo = {};

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	metricsKeys.forEach(key => (aggregatedPresenceData[key] = getNumberPerValue(metricsData[key]!)));

	return aggregatedPresenceData;
};
