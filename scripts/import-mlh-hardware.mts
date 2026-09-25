import { PrismaClient } from "@prisma/client";

// This script runs from the deliberately minimal production migration image,
// so keep its imports relative instead of depending on application path aliases.
// eslint-disable-next-line no-restricted-imports
import {
	applyMlhHardwareImport,
	inspectMlhHardwareImport,
	mlhHardwareSource,
} from "../src/server/services/mlh-hardware.ts";

const prisma = new PrismaClient();

const apply = process.argv.slice(2).includes("--apply");
const inspection = await inspectMlhHardwareImport(prisma);
console.log({ source: mlhHardwareSource, ...inspection });
if (inspection.errors.length > 0) {
	process.exitCode = 1;
} else if (!apply) {
	console.log(
		inspection.alreadyApplied
			? "MLH hardware is already present."
			: "Dry run only. Re-run with --apply after backup, review, and explicit database authorisation.",
	);
} else {
	console.log(await applyMlhHardwareImport(prisma));
}
await prisma.$disconnect();
