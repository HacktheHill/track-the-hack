import type { SVGProps } from "react";
import {Prisma } from "@prisma/client";
import { select } from "@nextui-org/react";
export default interface IconSvgProps extends SVGProps<SVGSVGElement> {
	size?: number;
}

// If you need a type for a query, please use this function
export const createPayload = <T>(keys: (keyof T)[]): { select: Record<keyof T, true> } => {
	const selectObject = {} as Record<keyof T, true>; // Use type assertion as we are dynamically adding properties

	for (const key of keys) {
		selectObject[key] = true;
	}

	return { select: selectObject };
};

export type PayloadSelect<T> =  { select: { [K in keyof Required<Omit<T, "_count">>]: true } }
export type Hacker = Prisma.HackerGetPayload<PayloadSelect<Prisma.HackerSelect>>
export type Presence = Prisma.PresenceGetPayload<PayloadSelect<Prisma.PresenceSelect>>