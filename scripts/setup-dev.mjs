import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";

const envPath = new URL("../.env", import.meta.url);
const examplePath = new URL("../.env.example", import.meta.url);
const secretNames = [
	"NEXTAUTH_SECRET",
	"SHEETS_INTEGRATION_API_KEY",
	"CANCELLATION_TOKEN_SECRET",
	"CLAIM_TOKEN_SECRET",
	"PARTICIPANT_SESSION_SECRET",
];
const developmentDefaults = { DEV_AUTH_ENABLED: "1" };

let created = false;
/** @type {string} */
let contents;
try {
	contents = await readFile(envPath, "utf8");
} catch (error) {
	if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
	contents = await readFile(examplePath, "utf8");
	created = true;
}

const generated = [];
for (const name of secretNames) {
	const active = new RegExp(`^([ \\t]*)${name}[ \\t]*=(.*)$`, "m");
	const current = contents.match(active);
	const currentValue = current?.[2];
	if (currentValue !== undefined && !["", '""', "''"].includes(currentValue.trim())) continue;

	const line = `${name}=${randomBytes(32).toString("base64url")}`;
	if (current) {
		contents = contents.replace(active, line);
	} else {
		const commented = new RegExp(`^[ \\t]*#[ \\t]*${name}[ \\t]*=.*$`, "m");
		contents = commented.test(contents) ? contents.replace(commented, line) : `${contents.trimEnd()}\n${line}\n`;
	}
	generated.push(name);
}

for (const [name, value] of Object.entries(developmentDefaults)) {
	const active = new RegExp(`^([ \\t]*)${name}[ \\t]*=(.*)$`, "m");
	const current = contents.match(active);
	const currentValue = current?.[2];
	if (currentValue !== undefined && !["", '""', "''"].includes(currentValue.trim())) continue;

	const line = `${name}=${value}`;
	contents = current ? contents.replace(active, line) : `${contents.trimEnd()}\n${line}\n`;
	generated.push(name);
}

if (created || generated.length > 0) await writeFile(envPath, contents, { mode: 0o600 });
await chmod(envPath, 0o600);

const action = created ? "Created" : generated.length > 0 ? "Updated" : "Kept";
console.info(
	`${action} .env${generated.length > 0 ? `; generated ${generated.join(", ")}` : "; all values already set"}.`,
);
