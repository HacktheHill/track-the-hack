type StrKeyAnyVal = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
};

type StrKeyStrVal = {
	[key: string]: string;
};

type StrKeyNumVal = {
	[key: string]: number;
};

type TremorChartData = { name: string; value: number; title: string }[];

type AggregatedHackerInfo = {
	[key: string]: (StrKeyAnyVal & {
		name?: string | undefined;
		value?: number | undefined;
		title?: string | undefined;
	})[];
};

type AggregatedPresenceInfo = {
	[key: string]: TremorChartData;
};

export type { StrKeyAnyVal, StrKeyStrVal, StrKeyNumVal, TremorChartData, AggregatedHackerInfo, AggregatedPresenceInfo };
