import { HardwareCategory, type PrismaClient } from "@prisma/client";

export type HardwareImportRow = {
	importKey: string;
	category: string;
	name: string;
	quantity: string;
	description?: string;
	imageUrl?: string;
};
export type ValidHardwareImportRow = {
	importKey: string;
	category: HardwareCategory;
	name: string;
	normalizedName: string;
	quantity: number;
	description?: string;
	imageURL?: string;
};

const categories: Record<string, HardwareCategory> = {
	inputs: HardwareCategory.INPUTS,
	outputs: HardwareCategory.OUTPUTS,
	microcontrollers: HardwareCategory.MICROCONTROLLERS,
	miscellaneous: HardwareCategory.MISCELLANEOUS,
};
export const normalizeHardwareName = (value: string) => value.trim().toLocaleLowerCase("en-CA").replace(/\s+/g, " ");

export const validateHardwareImport = (rows: HardwareImportRow[]) => {
	const errors: string[] = [];
	const valid: ValidHardwareImportRow[] = [];
	const keys = new Set<string>();
	const names = new Set<string>();
	rows.forEach((row, index) => {
		const line = index + 2;
		const importKey = row.importKey?.trim();
		const name = row.name?.trim();
		const category = categories[row.category?.trim().toLocaleLowerCase("en-CA")];
		const quantity = Number(row.quantity);
		if (!importKey || !/^[a-z0-9][a-z0-9_-]*$/i.test(importKey))
			errors.push(`Row ${line}: invalid stable import key`);
		else if (keys.has(importKey)) errors.push(`Row ${line}: duplicate import key ${importKey}`);
		else keys.add(importKey);
		if (!category) errors.push(`Row ${line}: unknown category ${row.category ?? ""}`);
		if (!name) errors.push(`Row ${line}: blank display name`);
		if (!/^\d+$/.test(row.quantity?.trim() ?? "") || !Number.isSafeInteger(quantity) || quantity < 0)
			errors.push(`Row ${line}: quantity must be a non-negative integer`);
		if (/\b(bulk|bag|box|assorted|various)\b/i.test(`${row.quantity ?? ""} ${name ?? ""}`))
			errors.push(`Row ${line}: unresolved bulk checkout unit`);
		if (row.imageUrl && !/^\/assets\/[A-Za-z0-9_./-]+$/.test(row.imageUrl.trim()))
			errors.push(`Row ${line}: image must be a reviewed local /assets/ reference`);
		const normalizedName = normalizeHardwareName(name ?? "");
		const nameKey = `${category ?? "unknown"}:${normalizedName}`;
		if (name && category) {
			if (names.has(nameKey)) errors.push(`Row ${line}: duplicate normalized name within category`);
			else names.add(nameKey);
		}
		if (importKey && category && name && Number.isSafeInteger(quantity) && quantity >= 0)
			valid.push({
				importKey,
				category,
				name,
				normalizedName,
				quantity,
				...(row.description?.trim() ? { description: row.description.trim() } : {}),
				...(row.imageUrl?.trim() ? { imageURL: row.imageUrl.trim() } : {}),
			});
	});
	return { errors, rows: valid, totalQuantity: valid.reduce((sum, row) => sum + row.quantity, 0) };
};

export const applyHardwareImport = async (prisma: PrismaClient, rows: ValidHardwareImportRow[]) =>
	prisma.$transaction(async tx => {
		const [legacy, items, loans] = await Promise.all([
			tx.hardware.count(),
			tx.hardwareItem.count(),
			tx.hardwareLoan.count(),
		]);
		if (legacy > 0) throw new Error(`Refusing import: legacy Hardware contains ${legacy} row(s)`);
		if (items > 0 || loans > 0)
			throw new Error(`Refusing import: target is not empty (${items} item(s), ${loans} loan(s))`);
		await tx.hardwareItem.createMany({
			data: rows.map(row => ({
				importKey: row.importKey,
				category: row.category,
				name: row.name,
				normalizedName: row.normalizedName,
				description: row.description,
				imageURL: row.imageURL,
				totalQuantity: row.quantity,
				availableQuantity: row.quantity,
			})),
		});
		return { itemCount: rows.length, totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0) };
	});
