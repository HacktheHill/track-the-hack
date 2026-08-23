import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pwaArtifact = /^(?:sw\.js(?:\.map)?|workbox-.*\.js(?:\.map)?)$/;

const artifactNames = async publicDirectory => {
	try {
		return (await readdir(publicDirectory)).filter(name => pwaArtifact.test(name));
	} catch (error) {
		if (error?.code === "ENOENT") return [];
		throw error;
	}
};

export const snapshotPwaArtifacts = async publicDirectory =>
	new Map(
		await Promise.all(
			(await artifactNames(publicDirectory)).map(async name => {
				const path = join(publicDirectory, name);
				return [name, { contents: await readFile(path), mode: (await stat(path)).mode & 0o777 }];
			}),
		),
	);

export const restorePwaArtifacts = async (publicDirectory, snapshot, generatedNames = new Set()) => {
	for (const name of generatedNames) await rm(join(publicDirectory, name), { force: true });

	await mkdir(publicDirectory, { recursive: true });
	for (const [name, artifact] of snapshot) {
		const path = join(publicDirectory, name);
		await writeFile(path, artifact.contents);
		await chmod(path, artifact.mode);
	}
};

const run = (command, args, label) => {
	const result = spawnSync(command, args, { cwd: process.cwd(), env: process.env, stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${label} failed${result.signal ? ` with ${result.signal}` : ""}.`);
};

const runPwaE2e = async () => {
	const publicDirectory = join(process.cwd(), "public");
	const snapshot = await snapshotPwaArtifacts(publicDirectory);
	let generatedNames = new Set();
	const npm = process.platform === "win32" ? "npm.cmd" : "npm";

	try {
		try {
			run(npm, ["run", "build"], "PWA build");
		} finally {
			generatedNames = new Set((await artifactNames(publicDirectory)).filter(name => !snapshot.has(name)));
		}
		run(process.execPath, ["--env-file=.env", "scripts/test-pwa-e2e.mjs"], "PWA E2E");
	} finally {
		await restorePwaArtifacts(publicDirectory, snapshot, generatedNames);
	}
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	runPwaE2e().catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
}
