import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pwaArtifact = /^(?:sw\.js(?:\.map)?|workbox-.*\.js(?:\.map)?)$/;

/** @typedef {{contents: Buffer, mode: number}} PwaArtifact */
/** @typedef {Map<string, PwaArtifact>} PwaArtifactSnapshot */

/** @param {string} publicDirectory */
const artifactNames = async publicDirectory => {
	try {
		return (await readdir(publicDirectory)).filter(name => pwaArtifact.test(name));
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
		throw error;
	}
};

/**
 * @param {string} publicDirectory
 * @param {string} name
 * @returns {Promise<[string, PwaArtifact]>}
 */
const snapshotArtifact = async (publicDirectory, name) => {
	const path = join(publicDirectory, name);
	return [name, { contents: await readFile(path), mode: (await stat(path)).mode & 0o777 }];
};

/**
 * @param {string} publicDirectory
 * @returns {Promise<PwaArtifactSnapshot>}
 */
export const snapshotPwaArtifacts = async publicDirectory =>
	new Map(
		await Promise.all((await artifactNames(publicDirectory)).map(name => snapshotArtifact(publicDirectory, name))),
	);

/**
 * @param {string} publicDirectory
 * @param {PwaArtifactSnapshot} snapshot
 * @param {Set<string>} [generatedNames]
 */
export const restorePwaArtifacts = async (publicDirectory, snapshot, generatedNames = new Set()) => {
	for (const name of generatedNames) await rm(join(publicDirectory, name), { force: true });

	await mkdir(publicDirectory, { recursive: true });
	for (const [name, artifact] of snapshot) {
		const path = join(publicDirectory, name);
		await writeFile(path, artifact.contents);
		await chmod(path, artifact.mode);
	}
};

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} label
 */
const run = (command, args, label) => {
	const result = spawnSync(command, args, { cwd: process.cwd(), env: process.env, stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${label} failed${result.signal ? ` with ${result.signal}` : ""}.`);
};

const runPwaE2e = async () => {
	const publicDirectory = join(process.cwd(), "public");
	const snapshot = await snapshotPwaArtifacts(publicDirectory);
	/** @type {Set<string>} */
	let generatedNames = new Set();
	const npm = process.platform === "win32" ? "npm.cmd" : "npm";

	try {
		try {
			run(npm, ["run", "build"], "PWA build");
		} finally {
			generatedNames = new Set((await artifactNames(publicDirectory)).filter(name => !snapshot.has(name)));
		}
		run(process.execPath, ["--env-file=.env", "--import", "tsx", "scripts/test-pwa-e2e.mts"], "PWA E2E");
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
