export const SCHEDULE_TIME_ZONE = "America/Toronto";

export const scheduleDayKey = (date: Date) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: SCHEDULE_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const get = (part: string) => parts.find(item => item.type === part)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")}`;
};

export const scheduleDayKeys = (start: Date, end: Date) => {
	const days: string[] = [];
	let cursor = new Date(`${scheduleDayKey(start)}T12:00:00Z`);
	const lastDay = scheduleDayKey(new Date(Math.max(start.getTime(), end.getTime() - 1)));
	while (cursor.toISOString().slice(0, 10) <= lastDay) {
		days.push(cursor.toISOString().slice(0, 10));
		cursor = new Date(cursor.getTime() + 86_400_000);
	}
	return days;
};

export const formatScheduleDate = (date: Date, locale: string, options: Intl.DateTimeFormatOptions) =>
	date.toLocaleDateString(locale, { ...options, timeZone: SCHEDULE_TIME_ZONE });

export const formatScheduleTime = (date: Date, locale: string) =>
	date.toLocaleTimeString(locale, { hour: "numeric", minute: "numeric", timeZone: SCHEDULE_TIME_ZONE });
