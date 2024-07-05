import type { SVGProps } from "react";

export default interface IconSvgProps extends SVGProps<SVGSVGElement> {
	size?: number;
}

import type { HackerInfo, PresenceInfo } from "@prisma/client";

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

type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[] ? ElementType : never;

type HackerInfoKey = keyof HackerInfo;

type PresenceInfoKey = keyof PresenceInfo;

type TremorChartData = { name: string; value: number; title: string }[];

type AggregatedHackerInfo = {
	[key in HackerInfoKey]: (StrKeyAnyVal & ArrElement<TremorChartData>)[];
};

type AggregatedPresenceInfo = {
	[key in PresenceInfoKey]: TremorChartData;
};

export type {
	StrKeyAnyVal,
	StrKeyStrVal,
	StrKeyNumVal,
	ArrElement,
	HackerInfoKey,
	PresenceInfoKey,
	TremorChartData,
	AggregatedHackerInfo,
	AggregatedPresenceInfo,
};
