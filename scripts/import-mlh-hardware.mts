import { prisma } from "@/server/db";
import { applyMlhHardwareImport, inspectMlhHardwareImport, mlhHardwareSource } from "@/server/services/mlh-hardware";

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
