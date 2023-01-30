import { PrismaClient } from "@prisma/client";
declare module "@prisma/client" {
	export interface AttendanceType {
		IN_PERSON: "IN_PERSON";
		ONLINE: "ONLINE";
	}
	export interface Language {
		EN: "EN";
		FR: "FR";
	}
	export interface ShirtSize {
		S: "S";
		M: "M";
		L: "L";
		XL: "XL";
	}
	export const AttendanceType: AttendanceType;
	export const Language: Language;
	export const ShirtSize: ShirtSize;
	export default PrismaClient;
}
