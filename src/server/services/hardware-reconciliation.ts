import { HardwareInventoryMode, Prisma, type PrismaClient } from "@prisma/client";

const uncountedKeys = [
	"small-black-buttons",
	"the-red-button",
	"mixed-colour-leds",
	"male-pin-headers",
	"resistors",
	"wires",
] as const;
const countedConsumptionKeys = ["aa-batteries", "emg-electrodes"] as const;
const uncountedKeySet = new Set<string>(uncountedKeys);
export const hardwareReconciliationKeys = [...uncountedKeys, ...countedConsumptionKeys] as const;

const selection = {
	id: true,
	importKey: true,
	name: true,
	inventoryMode: true,
	totalQuantity: true,
	availableQuantity: true,
	availableForCheckout: true,
	damagedQuantity: true,
	missingQuantity: true,
	consumedQuantity: true,
	consumptionAllowed: true,
	description: true,
	_count: { select: { loanLines: true } },
} satisfies Prisma.HardwareItemSelect;

type HardwarePrisma = Pick<PrismaClient, "hardwareItem">;
type HardwareReconciliationItem = Prisma.HardwareItemGetPayload<{ select: typeof selection }>;

export const evaluateHardwareReconciliation = (items: HardwareReconciliationItem[]) => {
	const byKey = new Map(items.map(item => [item.importKey, item]));
	const errors: string[] = [];
	for (const importKey of hardwareReconciliationKeys) {
		if (!byKey.has(importKey)) errors.push(`Missing hardware item ${importKey}`);
	}
	for (const importKey of uncountedKeys) {
		const item = byKey.get(importKey);
		if (!item) continue;
		const alreadyConverted =
			item.inventoryMode === HardwareInventoryMode.UNCOUNTED &&
			item.totalQuantity === null &&
			item.availableQuantity === null;
		if (!alreadyConverted && item._count.loanLines > 0)
			errors.push(`${importKey} has ${item._count.loanLines} loan line(s)`);
		if (!alreadyConverted && (item.damagedQuantity > 0 || item.missingQuantity > 0 || item.consumedQuantity > 0))
			errors.push(`${importKey} has aggregate outcome quantities`);
	}
	for (const importKey of countedConsumptionKeys) {
		const item = byKey.get(importKey);
		if (item && item.inventoryMode !== HardwareInventoryMode.COUNTED)
			errors.push(`${importKey} must remain counted`);
	}
	return {
		errors,
		items,
		alreadyApplied:
			errors.length === 0 &&
			items.every(item => {
				if (!item.consumptionAllowed) return false;
				return (
					!uncountedKeySet.has(item.importKey) ||
					(item.inventoryMode === HardwareInventoryMode.UNCOUNTED &&
						item.totalQuantity === null &&
						item.availableQuantity === null &&
						item.description === null)
				);
			}),
	};
};

export const inspectHardwareReconciliation = async (prisma: HardwarePrisma) =>
	evaluateHardwareReconciliation(
		await prisma.hardwareItem.findMany({
			where: { importKey: { in: [...hardwareReconciliationKeys] } },
			select: selection,
			orderBy: { importKey: "asc" },
		}),
	);

export const applyHardwareReconciliation = async (prisma: PrismaClient) =>
	prisma.$transaction(
		async tx => {
			const inspection = await inspectHardwareReconciliation(tx);
			if (inspection.errors.length) throw new Error(inspection.errors.join("\n"));
			if (inspection.alreadyApplied) return { changed: false, items: inspection.items };
			for (const importKey of uncountedKeys) {
				const current = inspection.items.find(item => item.importKey === importKey);
				if (
					current?.inventoryMode === HardwareInventoryMode.UNCOUNTED &&
					current.totalQuantity === null &&
					current.availableQuantity === null &&
					current.consumptionAllowed &&
					current.description === null
				)
					continue;
				await tx.hardwareItem.update({
					where: { importKey },
					data: {
						inventoryMode: HardwareInventoryMode.UNCOUNTED,
						totalQuantity: null,
						availableQuantity: null,
						availableForCheckout: true,
						consumptionAllowed: true,
						description: null,
					},
				});
			}
			await tx.hardwareItem.updateMany({
				where: { importKey: { in: [...countedConsumptionKeys] } },
				data: { consumptionAllowed: true },
			});
			return { changed: true, items: (await inspectHardwareReconciliation(tx)).items };
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
