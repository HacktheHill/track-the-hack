import { readFile } from "node:fs/promises";
import csv from "csvtojson";
import { z } from "zod";
import { prisma } from "@/server/db";
import { applyHardwareImport, validateHardwareImport } from "@/server/services/hardware-import";

const apply = process.argv.includes("--apply");
const path = process.argv.find(
	argument => !argument.startsWith("--") && argument !== process.argv[0] && argument !== process.argv[1],
);
if (!path) throw new Error("Usage: npm run hardware:import -- <cleaned.csv> [--apply]");
const raw: unknown = await csv({ trim: true, checkType: false }).fromString(await readFile(path, "utf8"));
const rows = z
	.array(
		z
			.object({
				importKey: z.string(),
				category: z.string(),
				name: z.string(),
				quantity: z.string(),
				inventoryMode: z.string(),
				consumptionAllowed: z.string(),
				description: z.string().optional(),
				imageUrl: z.string().optional(),
			})
			.strict(),
	)
	.parse(raw);
const result = validateHardwareImport(rows);
if (result.errors.length) {
	console.error(result.errors.join("\n"));
	process.exitCode = 1;
} else if (!apply)
	console.log(
		`Dry run passed: ${result.countedItemCount} counted item types, ${result.totalKnownQuantity} known units, ${result.uncountedItemCount} uncounted item types, and ${result.consumptionEnabledItemCount} consumption-enabled item types. Re-run with --apply after review.`,
	);
else console.log(await applyHardwareImport(prisma, result.rows));
await prisma.$disconnect();
