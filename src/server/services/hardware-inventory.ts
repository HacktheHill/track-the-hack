import { HardwareInventoryMode } from "@prisma/client";

export type HardwareOutcome = {
	good: number;
	damaged: number;
	missing: number;
	consumed: number;
};

export type HardwareLineState = {
	borrowedQuantity: number;
	goodQuantity: number;
	damagedQuantity: number;
	missingQuantity: number;
	consumedQuantity: number;
};

export const resolvedHardwareQuantity = (outcome: HardwareOutcome) =>
	outcome.good + outcome.damaged + outcome.missing + outcome.consumed;

export const outstandingHardwareQuantity = (line: HardwareLineState) =>
	line.borrowedQuantity - line.goodQuantity - line.damagedQuantity - line.missingQuantity - line.consumedQuantity;

export const hardwareReturnError = (
	line: HardwareLineState & { consumptionAllowed: boolean },
	outcome: HardwareOutcome,
) => {
	if (outcome.consumed > 0 && !line.consumptionAllowed) return "Consumed is not allowed for this hardware item";
	if (resolvedHardwareQuantity(outcome) > outstandingHardwareQuantity(line))
		return "Return exceeds outstanding quantity";
	return null;
};

export const isHardwareAvailable = (item: {
	inventoryMode: HardwareInventoryMode;
	availableQuantity: number | null;
	availableForCheckout: boolean;
}) =>
	item.inventoryMode === HardwareInventoryMode.COUNTED
		? (item.availableQuantity ?? 0) > 0
		: item.availableForCheckout;
