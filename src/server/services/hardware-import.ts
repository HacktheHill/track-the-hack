import { HardwareCategory, HardwareInventoryMode, type PrismaClient } from "@prisma/client";

export type HardwareImportRow = {
	importKey: string;
	category: string;
	name: string;
	quantity: string;
	inventoryMode: string;
	consumptionAllowed: string;
	description?: string;
	imageUrl?: string;
};
export type ValidHardwareImportRow = {
	importKey: string;
	category: HardwareCategory;
	name: string;
	normalizedName: string;
	inventoryMode: HardwareInventoryMode;
	quantity: number | null;
	consumptionAllowed: boolean;
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
		const inventoryModeText = row.inventoryMode?.trim().toUpperCase();
		const inventoryMode = Object.values(HardwareInventoryMode).find(value => value === inventoryModeText);
		const quantityText = row.quantity?.trim() ?? "";
		const quantity = Number(quantityText);
		const consumptionText = row.consumptionAllowed?.trim().toLocaleLowerCase("en-CA");
		const consumptionAllowed = consumptionText === "true" ? true : consumptionText === "false" ? false : null;
		if (!importKey || !/^[a-z0-9][a-z0-9_-]*$/i.test(importKey))
			errors.push(`Row ${line}: invalid stable import key`);
		else if (keys.has(importKey)) errors.push(`Row ${line}: duplicate import key ${importKey}`);
		else keys.add(importKey);
		if (!category) errors.push(`Row ${line}: unknown category ${row.category ?? ""}`);
		if (!inventoryMode) errors.push(`Row ${line}: inventory mode must be COUNTED or UNCOUNTED`);
		if (!name) errors.push(`Row ${line}: blank display name`);
		if (inventoryMode === HardwareInventoryMode.COUNTED) {
			if (!/^\d+$/.test(quantityText) || !Number.isSafeInteger(quantity) || quantity < 0)
				errors.push(`Row ${line}: counted quantity must be a non-negative integer`);
		} else if (inventoryMode === HardwareInventoryMode.UNCOUNTED && quantityText)
			errors.push(`Row ${line}: uncounted quantity must be blank`);
		if (/\b(bulk|bag|box)\b/i.test(name ?? "")) errors.push(`Row ${line}: unresolved bulk display name`);
		if (consumptionAllowed === null) errors.push(`Row ${line}: consumptionAllowed must be true or false`);
		if (row.imageUrl && !/^\/assets\/[A-Za-z0-9_./-]+$/.test(row.imageUrl.trim()))
			errors.push(`Row ${line}: image must be a reviewed local /assets/ reference`);
		const normalizedName = normalizeHardwareName(name ?? "");
		const nameKey = `${category ?? "unknown"}:${normalizedName}`;
		if (name && category) {
			if (names.has(nameKey)) errors.push(`Row ${line}: duplicate normalized name within category`);
			else names.add(nameKey);
		}
		if (
			importKey &&
			category &&
			name &&
			inventoryMode &&
			consumptionAllowed !== null &&
			(inventoryMode === HardwareInventoryMode.UNCOUNTED ||
				(Number.isSafeInteger(quantity) && quantity >= 0 && /^\d+$/.test(quantityText)))
		)
			valid.push({
				importKey,
				category,
				name,
				normalizedName,
				inventoryMode,
				quantity: inventoryMode === HardwareInventoryMode.COUNTED ? quantity : null,
				consumptionAllowed,
				...(row.description?.trim() ? { description: row.description.trim() } : {}),
				...(row.imageUrl?.trim() ? { imageURL: row.imageUrl.trim() } : {}),
			});
	});
	return {
		errors,
		rows: valid,
		countedItemCount: valid.filter(row => row.inventoryMode === HardwareInventoryMode.COUNTED).length,
		totalKnownQuantity: valid.reduce((sum, row) => sum + (row.quantity ?? 0), 0),
		uncountedItemCount: valid.filter(row => row.inventoryMode === HardwareInventoryMode.UNCOUNTED).length,
		consumptionEnabledItemCount: valid.filter(row => row.consumptionAllowed).length,
	};
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
				inventoryMode: row.inventoryMode,
				totalQuantity: row.quantity,
				availableQuantity: row.quantity,
				consumptionAllowed: row.consumptionAllowed,
			})),
		});
		return {
			itemCount: rows.length,
			countedItemCount: rows.filter(row => row.inventoryMode === HardwareInventoryMode.COUNTED).length,
			totalKnownQuantity: rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0),
			uncountedItemCount: rows.filter(row => row.inventoryMode === HardwareInventoryMode.UNCOUNTED).length,
			consumptionEnabledItemCount: rows.filter(row => row.consumptionAllowed).length,
		};
	});
