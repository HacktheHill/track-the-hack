import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const secretNames = [
	"NEXTAUTH_SECRET",
	"SHEETS_INTEGRATION_API_KEY",
	"CANCELLATION_TOKEN_SECRET",
	"CLAIM_TOKEN_SECRET",
	"PARTICIPANT_SESSION_SECRET",
];

const readAssignments = (contents: string) =>
	new Map(
		contents
			.split("\n")
			.flatMap(line => {
				const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
				return match ? [[match[1], match[2]] as const] : [];
			}),
	);

void test("development env setup is complete, non-destructive, and idempotent", async () => {
	const directory = await mkdtemp(join(tmpdir(), "track-the-hack-setup-"));
	const script = join(directory, "scripts", "setup-dev.mjs");
	const envPath = join(directory, ".env");

	try {
		await mkdir(join(directory, "scripts"));
		await Promise.all([
			copyFile(join(projectRoot, "scripts", "setup-dev.mjs"), script),
			copyFile(join(projectRoot, ".env.example"), join(directory, ".env.example")),
		]);

		const run = () => spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
		assert.equal(run().status, 0);
		const created = await readFile(envPath, "utf8");
		const createdAssignments = readAssignments(created);
		for (const name of secretNames) assert.ok((createdAssignments.get(name)?.length ?? 0) >= 32);
		assert.equal(createdAssignments.get("DEV_AUTH_ENABLED"), "1");
		assert.equal((await stat(envPath)).mode & 0o777, 0o600);

		await chmod(envPath, 0o644);
		assert.equal(run().status, 0);
		assert.equal(await readFile(envPath, "utf8"), created);
		assert.equal((await stat(envPath)).mode & 0o777, 0o600, "unchanged .env must still be private");

		const existing = "existing-development-secret-that-must-stay";
		await writeFile(envPath, created.replace(/^NEXTAUTH_SECRET=.*$/m, `NEXTAUTH_SECRET=${existing}`));
		assert.equal(run().status, 0);
		assert.equal(readAssignments(await readFile(envPath, "utf8")).get("NEXTAUTH_SECRET"), existing);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
