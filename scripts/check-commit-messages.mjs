import { execFileSync } from "node:child_process";

const conventionalSubject = /^(feat|fix|refactor|docs|test|build|ci|chore|perf|revert)(\([a-z0-9._/-]+\))?!?: .+/;
const head = process.env.COMMIT_HEAD || "HEAD";
const requestedBase = process.env.COMMIT_BASE;

/** @param {string | undefined} commit */
const commitExists = commit => {
	if (!commit || /^0+$/.test(commit)) return false;
	try {
		execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
};

const base = commitExists(requestedBase) ? requestedBase : undefined;
if (requestedBase && !base) {
	console.error(`Unable to validate commits because base ${requestedBase} is unavailable.`);
	process.exit(1);
}
const range = base ? `${base}..${head}` : `${head}^..${head}`;
const output = execFileSync("git", ["log", range, "--no-merges", "--format=%H%x09%s"], { encoding: "utf8" }).trim();
const invalid = output
	? output.split("\n").filter(line => !conventionalSubject.test(line.slice(line.indexOf("\t") + 1)))
	: [];

if (invalid.length) {
	console.error("Commit subjects must use type(optional-scope): imperative summary:");
	for (const line of invalid) console.error(`  ${line}`);
	process.exitCode = 1;
}
