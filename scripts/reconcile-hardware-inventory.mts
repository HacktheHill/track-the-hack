import { PrismaClient } from "@prisma/client";

// This script also runs from the deliberately minimal production migration image,
// so keep its imports relative instead of depending on application path aliases.
// eslint-disable-next-line no-restricted-imports
import {
	applyHardwareReconciliation,
	inspectHardwareReconciliation,
} from "../src/server/services/hardware-reconciliation.ts";

const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");
const inspection = await inspectHardwareReconciliation(prisma);
console.table(
	inspection.items.map(item => ({
		importKey: item.importKey,
		name: item.name,
		inventoryMode: item.inventoryMode,
		totalQuantity: item.totalQuantity,
		availableQuantity: item.availableQuantity,
		loanLines: item._count.loanLines,
		damagedQuantity: item.damagedQuantity,
		missingQuantity: item.missingQuantity,
		consumedQuantity: item.consumedQuantity,
		consumptionAllowed: item.consumptionAllowed,
	})),
);
if (inspection.errors.length) {
	console.error(inspection.errors.join("\n"));
	process.exitCode = 1;
} else if (!apply) {
	console.log(
		inspection.alreadyApplied
			? "Hardware reconciliation is already applied."
			: "Dry run passed. Re-run with --apply after review and authorization.",
	);
} else {
	console.log(await applyHardwareReconciliation(prisma));
}
await prisma.$disconnect();
