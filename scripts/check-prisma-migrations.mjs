import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// This standalone Node script cannot resolve the application's TypeScript alias.
// eslint-disable-next-line no-restricted-imports
import { findMigrationNameErrors } from "../src/server/lib/prisma-migration-names.mjs";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const root = resolve(dirname(scriptPath), "../prisma/migrations");
	const names = readdirSync(root, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => entry.name);
	const errors = findMigrationNameErrors(names);
	if (errors.length > 0) {
		console.error(errors.join("\n"));
		process.exitCode = 1;
	} else {
		console.log("Prisma migration directory names are valid.");
	}
}
