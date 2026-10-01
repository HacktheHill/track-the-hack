import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const archive = path.join(root, "archive");
const publicDir = path.join(archive, "public");

// Clean only this build's generated assets, never the live app's public directory.
await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
for (const asset of [
	"fonts",
	"icons",
	"assets/hackthehill-logo.svg",
	"assets/winners",
	"assets/resources",
	"assets/sponsors",
]) {
	await cp(path.join(root, "public", asset), path.join(publicDir, asset), { recursive: true });
}
for (const locale of ["en", "fr"]) {
	for (const namespace of ["common", "navbar", "winners", "resources", "sponsors"]) {
		const asset = `locales/${locale}/${namespace}.json`;
		await mkdir(path.dirname(path.join(publicDir, asset)), { recursive: true });
		await cp(path.join(root, "public", asset), path.join(publicDir, asset));
	}
}
await cp(path.join(root, "archive/hosting-assets"), publicDir, { recursive: true });

// An archive build must not require, inherit, or ship live application credentials.
/** @type {NodeJS.ProcessEnv} */
const env = {
	NODE_ENV: "production",
	...Object.fromEntries(
		Object.entries(process.env).filter(([key]) =>
			["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "CI", "SystemRoot"].includes(key),
		),
	),
};
env.NEXT_TELEMETRY_DISABLED = "1";
if (process.env.ARCHIVE_METRICS_FILE) env.ARCHIVE_METRICS_FILE = path.resolve(process.env.ARCHIVE_METRICS_FILE);
const result = spawnSync(
	process.execPath,
	[path.join(root, "node_modules/next/dist/bin/next"), "build", archive, "--webpack"],
	{
		cwd: archive,
		env,
		stdio: "inherit",
	},
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await writeFile(
	path.join(archive, "out/archive-build.json"),
	JSON.stringify(
		{
			formatVersion: 1,
			builtAt: new Date().toISOString(),
			publicOnly: true,
		},
		null,
		2,
	),
);
console.log("Static archive ready in archive/out (no app server or database required).");
