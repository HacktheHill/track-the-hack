import { readFile } from "node:fs/promises";
import { EventType, PrismaClient, ScannerWorkflow } from "@prisma/client";
import csv from "csvtojson";
import { z } from "zod";
import { eventImageUrl, httpsUrl } from "@/server/lib/event-validation";
import { parseTorontoDateTimeLocal } from "@/utils/toronto-time";

const rowSchema = z
	.object({
		importKey: z.string().trim().min(1).max(191),
		seriesKey: z.string().trim().min(1).max(191),
		start: z.string().trim().min(1),
		end: z.string().trim().min(1),
		hidden: z.enum(["TRUE", "FALSE"]),
		name: z.string().trim().min(1).max(191),
		nameFr: z.string().trim().min(1).max(191),
		type: z.nativeEnum(EventType),
		scannerWorkflow: z.nativeEnum(ScannerWorkflow),
		host: z.string().trim().max(191),
		description: z.string().trim().min(1).max(65_535),
		descriptionFr: z.string().trim().min(1).max(65_535),
		room: z.string().trim().min(1).max(191),
		roomFr: z.string().trim().max(191).optional(),
		image: z.union([z.literal(""), eventImageUrl]),
		link: z.union([z.literal(""), httpsUrl]),
		linkText: z.string().trim().max(191),
		linkTextFr: z.string().trim().max(191),
		maxCheckIns: z.string().trim(),
	})
	.strict();

const parseTorontoDate = (value: string) => {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (1[0-2]|[1-9]):(\d{2}) (AM|PM)$/.exec(value);
	if (!match) throw new Error(`Invalid Toronto date: ${value}`);
	const [, month, day, year, rawHour, minute, period] = match;
	if (!month || !day || !year || !rawHour || !minute || !period) throw new Error(`Invalid Toronto date: ${value}`);
	let hour = Number(rawHour) % 12;
	if (period === "PM") hour += 12;
	const local = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${String(hour).padStart(2, "0")}:${minute}`;
	try {
		return parseTorontoDateTimeLocal(local);
	} catch {
		throw new Error(`Invalid Toronto date: ${value}`);
	}
};

const nullable = (value: string) => value || null;
const args = process.argv.slice(2);
const inputPath = args.find(argument => !argument.startsWith("--")) ?? "prisma/hack-the-hill-iii-events.csv";
const apply = args.includes("--apply");
const source = await readFile(inputPath, "utf8");
const parsedRows = await csv({ output: "json" }).fromString(source);
const rows = z.array(rowSchema).parse(parsedRows);

if (new Set(rows.map(row => row.importKey)).size !== rows.length) {
	throw new Error("Every importKey must be unique");
}

const events = rows.map(row => {
	const start = parseTorontoDate(row.start);
	const end = parseTorontoDate(row.end);
	if (end <= start) throw new Error(`${row.importKey}: end must be after start`);
	if (Buffer.byteLength(row.description, "utf8") > 65_535 || Buffer.byteLength(row.descriptionFr, "utf8") > 65_535) {
		throw new Error(`${row.importKey}: descriptions must fit in a MySQL TEXT column`);
	}
	const linkValues = [row.link, row.linkText, row.linkTextFr];
	if (linkValues.some(Boolean) && !linkValues.every(Boolean)) {
		throw new Error(`${row.importKey}: link and both localized labels must be provided together`);
	}
	const maxCheckIns = row.maxCheckIns === "" ? null : Number(row.maxCheckIns);
	if (maxCheckIns !== null && (!Number.isInteger(maxCheckIns) || maxCheckIns < 0 || maxCheckIns > 2_147_483_647)) {
		throw new Error(`${row.importKey}: maxCheckIns must be a non-negative integer`);
	}

	return {
		importKey: row.importKey,
		seriesKey: row.seriesKey,
		start,
		end,
		hidden: row.hidden === "TRUE",
		name: row.name,
		nameFr: row.nameFr,
		type: row.type,
		scannerWorkflow: row.scannerWorkflow,
		host: nullable(row.host),
		description: row.description,
		descriptionFr: row.descriptionFr,
		room: row.room,
		roomFr: nullable(row.roomFr ?? ""),
		image: nullable(row.image),
		link: nullable(row.link),
		linkText: nullable(row.linkText),
		linkTextFr: nullable(row.linkTextFr),
		maxCheckIns,
	};
});

console.info(`Validated ${events.length} events from ${inputPath}.`);
if (!apply) {
	console.info("Dry run only. Pass --apply to upsert the schedule.");
	process.exit(0);
}

const prisma = new PrismaClient();
try {
	await prisma.$transaction(
		async transaction => {
			for (const event of events) {
				const [existing] = await transaction.$queryRaw<
					Array<{ id: string; start: Date; hidden: boolean; now: Date }>
				>`
					SELECT id, start, hidden, UTC_TIMESTAMP(3) AS now
					FROM Event
					WHERE importKey = ${event.importKey}
					FOR UPDATE
				`;
				if (!existing) {
					await transaction.event.create({ data: event });
					continue;
				}

				const reopenReminder =
					!event.hidden &&
					event.start > existing.now &&
					(existing.hidden || existing.start.getTime() !== event.start.getTime());
				await transaction.event.update({
					where: { id: existing.id },
					data: {
						...event,
						...(event.hidden ? { notifiedAt: existing.now } : reopenReminder ? { notifiedAt: null } : {}),
					},
				});
			}
		},
		{ maxWait: 10_000, timeout: 30_000 },
	);
} finally {
	await prisma.$disconnect();
}

console.info(`Upserted ${events.length} events.`);
