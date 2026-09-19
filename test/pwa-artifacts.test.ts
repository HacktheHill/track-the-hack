import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { restorePwaArtifacts, snapshotPwaArtifacts } from "@root/scripts/run-pwa-e2e.mjs";

void test("PWA E2E cleanup restores pre-existing artifacts and removes only generated files", async () => {
	const directory = await mkdtemp(join(tmpdir(), "track-the-hack-pwa-"));
	const publicDirectory = join(directory, "public");

	try {
		await mkdir(publicDirectory);
		await writeFile(join(publicDirectory, "sw.js"), "user service worker");
		await chmod(join(publicDirectory, "sw.js"), 0o640);
		await writeFile(join(publicDirectory, "workbox-existing.js"), "user workbox");
		await writeFile(join(publicDirectory, "worker-existing.js"), "user push worker");
		await writeFile(join(publicDirectory, "manifest.json"), "user manifest");
		const snapshot = await snapshotPwaArtifacts(publicDirectory);

		await writeFile(join(publicDirectory, "sw.js"), "generated service worker");
		await rm(join(publicDirectory, "workbox-existing.js"));
		await rm(join(publicDirectory, "worker-existing.js"));
		await writeFile(join(publicDirectory, "workbox-generated.js"), "generated workbox");
		await writeFile(join(publicDirectory, "workbox-generated.js.map"), "generated source map");
		await writeFile(join(publicDirectory, "workbox-concurrent.js"), "not created by this test build");

		await restorePwaArtifacts(
			publicDirectory,
			snapshot,
			new Set(["workbox-generated.js", "workbox-generated.js.map"]),
		);
		assert.equal(await readFile(join(publicDirectory, "sw.js"), "utf8"), "user service worker");
		assert.equal((await stat(join(publicDirectory, "sw.js"))).mode & 0o777, 0o640);
		assert.equal(await readFile(join(publicDirectory, "workbox-existing.js"), "utf8"), "user workbox");
		assert.equal(await readFile(join(publicDirectory, "worker-existing.js"), "utf8"), "user push worker");
		assert.equal(await readFile(join(publicDirectory, "manifest.json"), "utf8"), "user manifest");
		assert.equal(
			await readFile(join(publicDirectory, "workbox-concurrent.js"), "utf8"),
			"not created by this test build",
		);
		await assert.rejects(readFile(join(publicDirectory, "workbox-generated.js")), { code: "ENOENT" });
		await assert.rejects(readFile(join(publicDirectory, "workbox-generated.js.map")), { code: "ENOENT" });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
