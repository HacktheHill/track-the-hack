import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { privateMetricsFixture } from "@root/test/helpers/private-metrics-fixture";

// CI must never require, publish or upload a real private snapshot.
const temporary = await mkdtemp(path.join(tmpdir(), "hth-metrics-fixture-"));
try {
	const fixture = path.join(temporary, "fixture.json");
	await writeFile(fixture, JSON.stringify(privateMetricsFixture), { mode: 0o600 });
	const build = spawnSync(process.execPath, ["scripts/build-private-metrics.mjs"], {
		stdio: "inherit",
		env: { ...process.env, PRIVATE_METRICS_FILE: fixture },
	});
	if (build.error) throw build.error;
	if (build.status !== 0) throw new Error(`Private static build failed (${String(build.status)}).`);
	for (const route of ["index.html", "fr/index.html"]) {
		const html = await readFile(path.join("private-metrics/out", route), "utf8");
		if (!html.includes('"formatVersion":1')) throw new Error(`Missing snapshot in ${route}.`);
		if (html.includes("service-worker.js")) throw new Error(`Live service worker in ${route}.`);
	}
} finally {
	await rm(temporary, { recursive: true, force: true });
}
