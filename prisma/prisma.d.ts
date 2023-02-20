import { PrismaClient } from "@prisma/client";
declare module "@prisma/client" {
	export type AttendanceType = {
		IN_PERSON: "IN_PERSON";
		ONLINE: "ONLINE";
	};
	export type Language = {
		EN: "EN";
		FR: "FR";
	};
	export type ShirtSize = {
		S: "S";
		M: "M";
		L: "L";
		XL: "XL";
		XXL: "XXL";
	};
	export type Role = {
		HACKER: "HACKER";
		SPONSOR: "SPONSOR";
		ORGANIZER: "ORGANIZER";
	};
	export type EventType = {
		WORKSHOP: "WORKSHOP";
		SOCIAL: "SOCIAL";
		FOOD: "FOOD";
		CAREER_FAIR: "CAREER_FAIR";
	};

	export const AttendanceType: AttendanceType;
	export const Language: Language;
	export const ShirtSize: ShirtSize;
	export const Role: Role;
	export const EventType: EventType;
	export default PrismaClient;
}
