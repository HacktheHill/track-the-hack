const timeZone = "America/Toronto";
const formatter = new Intl.DateTimeFormat("en-CA", {
	timeZone,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23",
});

type DateTimeParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

const partsInToronto = (date: Date): DateTimeParts => {
	const parts = new Map<string, number>(formatter.formatToParts(date).map(part => [part.type, Number(part.value)]));
	const value = (name: string) => {
		const part = parts.get(name);
		if (part === undefined || Number.isNaN(part)) throw new Error(`Unable to format Toronto ${name}`);
		return part;
	};
	return {
		year: value("year"),
		month: value("month"),
		day: value("day"),
		hour: value("hour"),
		minute: value("minute"),
		second: value("second"),
	};
};

const partsTimestamp = ({ year, month, day, hour, minute, second }: DateTimeParts) =>
	Date.UTC(year, month - 1, day, hour, minute, second);

export const parseTorontoDateTimeLocal = (value: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
	if (!match) throw new Error(`Invalid Toronto date and time: ${value}`);
	const desired: DateTimeParts = {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
		hour: Number(match[4]),
		minute: Number(match[5]),
		second: 0,
	};
	const desiredTimestamp = partsTimestamp(desired);
	const normalized = new Date(desiredTimestamp);
	if (
		normalized.getUTCFullYear() !== desired.year ||
		normalized.getUTCMonth() + 1 !== desired.month ||
		normalized.getUTCDate() !== desired.day ||
		normalized.getUTCHours() !== desired.hour ||
		normalized.getUTCMinutes() !== desired.minute
	) {
		throw new Error(`Invalid Toronto date and time: ${value}`);
	}

	let timestamp = desiredTimestamp;
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const representedTimestamp = partsTimestamp(partsInToronto(new Date(timestamp)));
		const adjustment = desiredTimestamp - representedTimestamp;
		if (adjustment === 0) break;
		timestamp += adjustment;
	}

	const date = new Date(timestamp);
	if (partsTimestamp(partsInToronto(date)) !== desiredTimestamp) {
		throw new Error(`Invalid Toronto date and time: ${value}`);
	}
	const oneHour = 60 * 60 * 1000;
	if (
		partsTimestamp(partsInToronto(new Date(timestamp - oneHour))) === desiredTimestamp ||
		partsTimestamp(partsInToronto(new Date(timestamp + oneHour))) === desiredTimestamp
	) {
		throw new Error(`Ambiguous Toronto date and time: ${value}`);
	}
	return date;
};

export const formatTorontoDateTimeLocal = (date: Date) => {
	const { year, month, day, hour, minute } = partsInToronto(new Date(date));
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
