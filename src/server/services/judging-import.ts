import csv from "csvtojson";
import { z } from "zod";
import {
	ALL_JUDGING_CATEGORY_CODES,
	isJudgingCategoryCode,
	isMiniCategoryCode,
	MLH_CATEGORY_CODES,
	parseCategoryLabel,
	type JudgingCategoryCode,
	type JudgingMainTrackCode,
	type MiniCategoryCode,
} from "@/shared/judging";
import { normalizeOrganizerEmail } from "@/server/lib/organizer-auth";

export type ImportedJudgingProject = {
	externalId: string;
	name: string;
	tableNumber: number;
	room: string;
	devpostUrl: string;
	mainTrack: JudgingMainTrackCode;
	categories: MiniCategoryCode[];
};

export type ImportedJudge = {
	name: string;
	email: string;
	expertise: MiniCategoryCode[];
	requiredExpertise?: MiniCategoryCode[];
	exclusions: JudgingCategoryCode[];
};

export type ImportResult<T> = { rows: T[]; errors: string[]; warnings: string[] };

const projectRowSchema = z
	.object({
		project_name: z.string(),
		table_number: z.string(),
		room: z.string(),
		category_opt_ins: z.string(),
		eligible_category_count: z.string(),
		devpost_url: z.string(),
		devpost_project_id: z.string(),
	})
	.strict();

const judgeRowSchema = z
	.object({
		judge_name: z.string(),
		judge_email: z.string(),
		expertise: z.string().optional(),
		exclusion: z.string().optional(),
	})
	.strict();

const splitList = (value: string | undefined) =>
	(value ?? "")
		.split(";")
		.map(item => item.trim())
		.filter(Boolean);

const readCsv = async (source: string) => {
	const result: unknown = await csv({ trim: true, checkType: false }).fromString(source);
	return z.array(z.unknown()).parse(result);
};

export const parseProjectCsv = async (source: string): Promise<ImportResult<ImportedJudgingProject>> => {
	const errors: string[] = [];
	const warnings: string[] = [];
	const rows: ImportedJudgingProject[] = [];
	const rawRows = await readCsv(source);
	const ids = new Set<string>();
	const urls = new Set<string>();
	const tables = new Set<number>();

	for (const [index, raw] of rawRows.entries()) {
		const rowNumber = index + 2;
		const parsed = projectRowSchema.safeParse(raw);
		if (!parsed.success) {
			errors.push(
				`Project row ${rowNumber}: expected exactly project_name, table_number, room, category_opt_ins, eligible_category_count, devpost_url, and devpost_project_id.`,
			);
			continue;
		}
		const input = parsed.data;
		const name = input.project_name.trim();
		const room = input.room.trim();
		const externalId = input.devpost_project_id.trim();
		const tableNumber = Number(input.table_number);
		const expectedCount = Number(input.eligible_category_count);
		let devpostUrl: URL | undefined;
		try {
			devpostUrl = new URL(input.devpost_url.trim());
		} catch {
			// Reported below.
		}
		if (!name) errors.push(`Project row ${rowNumber}: project_name is required.`);
		if (!room) errors.push(`Project row ${rowNumber}: room is required.`);
		if (!externalId || externalId.length > 191)
			errors.push(`Project row ${rowNumber}: devpost_project_id is required and must be at most 191 characters.`);
		if (!Number.isInteger(tableNumber) || tableNumber < 1)
			errors.push(`Project row ${rowNumber}: table_number must be a positive integer.`);
		if (!Number.isInteger(expectedCount) || expectedCount < 0)
			errors.push(`Project row ${rowNumber}: eligible_category_count must be a non-negative integer.`);
		if (
			!devpostUrl ||
			devpostUrl.protocol !== "https:" ||
			(devpostUrl.hostname !== "devpost.com" && !devpostUrl.hostname.endsWith(".devpost.com"))
		) {
			errors.push(`Project row ${rowNumber}: devpost_url must be an HTTPS Devpost URL.`);
		}

		const rawCategories = splitList(input.category_opt_ins);
		if (Number.isInteger(expectedCount) && rawCategories.length !== expectedCount) {
			errors.push(
				`Project row ${rowNumber}: eligible_category_count is ${expectedCount}, but ${rawCategories.length} categories were listed.`,
			);
		}
		const parsedCategories: Array<JudgingCategoryCode | "CGI"> = [];
		for (const label of rawCategories) {
			const category = parseCategoryLabel(label);
			if (!category)
				errors.push(`Project row ${rowNumber}${name ? ` (${name})` : ""}: unknown category “${label}”.`);
			else parsedCategories.push(category);
		}
		const uniqueCategories = new Set(parsedCategories);
		if (uniqueCategories.size !== parsedCategories.length)
			errors.push(`Project row ${rowNumber}: category_opt_ins contains a duplicate category.`);
		const hasCgi = uniqueCategories.has("CGI");
		const hasCivic = uniqueCategories.has("CIVIC");
		const hasGeneral = uniqueCategories.has("GENERAL");
		if (hasCgi && (hasCivic || hasGeneral))
			errors.push(`Project row ${rowNumber}: CGI cannot be combined with General or Civic.`);
		const mainTrack: JudgingMainTrackCode = hasCgi ? "CGI" : hasCivic ? "CIVIC" : "GENERAL";
		if (!hasCgi && !hasCivic && !hasGeneral)
			warnings.push(`Project row ${rowNumber}: no main track was listed; defaulted to General.`);
		if (hasCivic && hasGeneral)
			warnings.push(`Project row ${rowNumber}: both Civic and General were listed; Civic takes precedence.`);

		if (ids.has(externalId)) errors.push(`Project row ${rowNumber}: duplicate devpost_project_id ${externalId}.`);
		if (devpostUrl && urls.has(devpostUrl.toString()))
			errors.push(`Project row ${rowNumber}: duplicate devpost_url.`);
		if (tables.has(tableNumber)) errors.push(`Project row ${rowNumber}: duplicate table_number ${tableNumber}.`);
		ids.add(externalId);
		if (devpostUrl) urls.add(devpostUrl.toString());
		tables.add(tableNumber);

		if (name && room && externalId && Number.isInteger(tableNumber) && devpostUrl) {
			rows.push({
				externalId,
				name,
				tableNumber,
				room,
				devpostUrl: devpostUrl.toString(),
				mainTrack,
				categories: [...uniqueCategories].filter(isMiniCategoryCode),
			});
		}
	}
	return { rows, errors, warnings };
};

export const parseJudgeCsv = async (source: string): Promise<ImportResult<ImportedJudge>> => {
	const errors: string[] = [];
	const warnings: string[] = [];
	const rows: ImportedJudge[] = [];
	const rawRows = await readCsv(source);
	const emails = new Set<string>();

	for (const [index, raw] of rawRows.entries()) {
		const rowNumber = index + 2;
		const parsed = judgeRowSchema.safeParse(raw);
		if (!parsed.success) {
			errors.push(`Judge row ${rowNumber}: expected exactly judge_name, judge_email, expertise, and exclusion.`);
			continue;
		}
		const input = parsed.data;
		const name = input.judge_name.trim();
		const emailResult = z.string().trim().email().max(191).safeParse(input.judge_email);
		if (!name) errors.push(`Judge row ${rowNumber}: judge_name is required.`);
		if (!emailResult.success) {
			errors.push(`Judge row ${rowNumber}: judge_email must be a valid email address.`);
			continue;
		}
		const email = normalizeOrganizerEmail(emailResult.data);
		if (emails.has(email)) errors.push(`Judge row ${rowNumber}: duplicate judge_email ${email}.`);
		emails.add(email);

		const expertise: MiniCategoryCode[] = [];
		const requiredExpertise: MiniCategoryCode[] = [];
		for (const value of splitList(input.expertise)) {
			const code = value.toUpperCase();
			if (code === "MLH") {
				for (const category of MLH_CATEGORY_CODES) {
					if (!expertise.includes(category)) expertise.push(category);
					if (!requiredExpertise.includes(category)) requiredExpertise.push(category);
				}
			} else if (!isMiniCategoryCode(code))
				errors.push(`Judge row ${rowNumber}: expertise “${value}” is not a mini/sponsor category code.`);
			else if (!expertise.includes(code)) expertise.push(code);
		}
		const exclusions: JudgingCategoryCode[] = [];
		for (const value of splitList(input.exclusion)) {
			const code = value.toUpperCase();
			if (!isJudgingCategoryCode(code))
				errors.push(`Judge row ${rowNumber}: exclusion “${value}” is not a judging category code.`);
			else if (!exclusions.includes(code)) exclusions.push(code);
		}
		for (const code of expertise) {
			if (exclusions.includes(code))
				errors.push(`Judge row ${rowNumber}: ${code} appears in both expertise and exclusion.`);
		}
		if (name) rows.push({ name, email, expertise, requiredExpertise, exclusions });
	}
	return { rows, errors, warnings };
};

export const judgingCsvTemplate = () => ({
	projectHeaders: [
		"project_name",
		"table_number",
		"room",
		"category_opt_ins",
		"eligible_category_count",
		"devpost_url",
		"devpost_project_id",
	],
	judgeHeaders: ["judge_name", "judge_email", "expertise", "exclusion"],
	categoryCodes: [...ALL_JUDGING_CATEGORY_CODES],
});
