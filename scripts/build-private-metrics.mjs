import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const site = path.join(root, "private-metrics");
if (!process.env.PRIVATE_METRICS_FILE)
	throw new Error("Set PRIVATE_METRICS_FILE to a reviewed aggregate snapshot outside the public archive.");
const generated = path.join(site, "public");
await rm(generated, { recursive: true, force: true });
await mkdir(generated, { recursive: true });
for (const asset of ["fonts", "icons"])
	await cp(path.join(root, "public", asset), path.join(generated, asset), { recursive: true });
for (const locale of ["en", "fr"])
	for (const ns of ["common", "metrics"]) {
		const dest = path.join(generated, "locales", locale, `${ns}.json`);
		await mkdir(path.dirname(dest), { recursive: true });
		await cp(path.join(root, "public/locales", locale, `${ns}.json`), dest);
	}
await cp(path.join(site, "hosting-assets"), generated, { recursive: true });
/** @type {NodeJS.ProcessEnv} */
const env = {
	NODE_ENV: "production",
	NEXT_TELEMETRY_DISABLED: "1",
	PRIVATE_METRICS_FILE: path.resolve(process.env.PRIVATE_METRICS_FILE),
	...Object.fromEntries(
		Object.entries(process.env).filter(([key]) =>
			["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "CI", "SystemRoot"].includes(key),
		),
	),
};
const result = spawnSync(
	process.execPath,
	[path.join(root, "node_modules/next/dist/bin/next"), "build", site, "--webpack"],
	{ cwd: site, env, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
	"Private static dashboard built. Deploy ONLY behind host-wide Cloudflare Access, including alternate deployment URLs.",
);
