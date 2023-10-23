import type { TremorChartData, StrKeyNumVal, AggregatedPresenceInfo, AggregatedHackerInfo } from "./types";
import type { HackerInfo, PresenceInfo } from "@prisma/client";
import { type Prisma } from "@prisma/client";
import type { ShirtSize } from "@prisma/client";

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

	const shirtSizes: ShirtSize[] = ["S", "M", "L", "XL", "XXL"];

	const values = Array.from(valueSet).sort((a, b) => {
		// sorting valToStr(true) before valToStr(false) so the "true" value is green and the other is red in the data charts
		if ((a === valToStr(true) && b === valToStr(false)) || (a === valToStr(false) && b === valToStr(true))) {
			return a === valToStr(true) ? -1 : 1;
			// sort shirt sizes in the given order
		} else if (shirtSizes.includes(a as ShirtSize) && shirtSizes.includes(b as ShirtSize)) {
			const idxA = shirtSizes.findIndex(size => size == a);
			const idxB = shirtSizes.findIndex(size => size == b);
			return (idxA - idxB) / Math.abs(idxA - idxB);
		} else {
			return a.localeCompare(b);
		}
	});
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

export function getMetricsKeysAndData<InfoType extends HackerInfo | PresenceInfo>(
	data: InfoType[],
	metricsData:
		| {
				[key in keyof HackerInfo]: AggregatedHackerInfo[key];
		  }
		| {
				[key in keyof PresenceInfo]: AggregatedPresenceInfo[key];
		  },
) {
	const metricsKeysSet = new Set<keyof InfoType>();
	data.forEach(datum => {
		Object.keys(datum).forEach(key => metricsKeysSet.add(key as keyof (HackerInfo | PresenceInfo)));
	});
	const metricsKeys = Array.from(metricsKeysSet);

	metricsKeys.forEach(key => (metricsData[key as keyof (HackerInfo | PresenceInfo)] = []));

	data.forEach((datum: HackerInfo | PresenceInfo) => {
		metricsKeys.forEach(key =>
			metricsData[key as keyof (HackerInfo | PresenceInfo)].push({
				title: key.toString(),
				value: 0,
				name: valToStr(datum[key as keyof (HackerInfo | PresenceInfo)]),
			}),
		);
	});

	return { metricsKeys };
}

export const getAggregatedHackerInfo = (hackerData: HackerInfo[]) => {
	const aggregatedHackerInfo: AggregatedHackerInfo = {
		id: [],
		preferredLanguage: [],
		email: [],
		firstName: [],
		lastName: [],
		gender: [],
		phoneNumber: [],
		university: [],
		studyLevel: [],
		studyProgram: [],
		graduationYear: [],
		attendanceType: [],
		location: [],
		transportationRequired: [],
		dietaryRestrictions: [],
		accessibilityRequirements: [],
		shirtSize: [],
		emergencyContactName: [],
		emergencyContactRelationship: [],
		emergencyContactPhoneNumber: [],
		numberOfPreviousHackathons: [],
		linkGithub: [],
		linkLinkedin: [],
		linkPersonalSite: [],
		linkResume: [],
		lookingForwardTo: [],
		formStartDate: [],
		formEndDate: [],
		confirmed: [],
		userId: [],
		unsubscribed: [],
		unsubscribeToken: [],
		onlyOnline: [],
		acceptanceExpiry: [],
		walkIn: [],
		winner: [],
	};
	const metricsData: AggregatedHackerInfo = {
		id: [],
		preferredLanguage: [],
		email: [],
		firstName: [],
		lastName: [],
		gender: [],
		phoneNumber: [],
		university: [],
		studyLevel: [],
		studyProgram: [],
		graduationYear: [],
		attendanceType: [],
		location: [],
		transportationRequired: [],
		dietaryRestrictions: [],
		accessibilityRequirements: [],
		shirtSize: [],
		emergencyContactName: [],
		emergencyContactRelationship: [],
		emergencyContactPhoneNumber: [],
		numberOfPreviousHackathons: [],
		linkGithub: [],
		linkLinkedin: [],
		linkPersonalSite: [],
		linkResume: [],
		lookingForwardTo: [],
		formStartDate: [],
		formEndDate: [],
		confirmed: [],
		userId: [],
		unsubscribed: [],
		unsubscribeToken: [],
		onlyOnline: [],
		acceptanceExpiry: [],
		walkIn: [],
		winner: [],
	};
	const { metricsKeys } = getMetricsKeysAndData(hackerData, metricsData);

	metricsKeys.forEach(key => {
		aggregatedHackerInfo[key] = getNumberPerValue(metricsData[key]);
	});

	return aggregatedHackerInfo;
};

export const getAggregatedPresenceInfo = (presenceData: Prisma.PresenceInfoGetPayload<true>[]) => {
	const metricsData: AggregatedPresenceInfo = {
		id: [],
		checkedIn: [],
		breakfast1: [],
		lunch1: [],
		dinner1: [],
		snacks: [],
		snacks2: [],
		redbull: [],
		breakfast2: [],
		lunch2: [],
		lunch22: [],
		hackerInfoId: [],
	};
	const { metricsKeys } = getMetricsKeysAndData(presenceData, metricsData);

	const aggregatedPresenceData: AggregatedPresenceInfo = {
		id: [],
		checkedIn: [],
		breakfast1: [],
		lunch1: [],
		dinner1: [],
		snacks: [],
		snacks2: [],
		redbull: [],
		breakfast2: [],
		lunch2: [],
		lunch22: [],
		hackerInfoId: [],
	};

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	metricsKeys.forEach(key => (aggregatedPresenceData[key] = getNumberPerValue(metricsData[key]!)));

	return aggregatedPresenceData;
};
