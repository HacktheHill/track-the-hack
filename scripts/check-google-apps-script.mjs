import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const codePath = fileURLToPath(new URL("../integrations/google-sheets/Code.gs", import.meta.url));
const virtualPath = `${codePath}.js`;
const source = await readFile(codePath, "utf8");
const options = {
	allowJs: true,
	checkJs: true,
	strict: true,
	noUncheckedIndexedAccess: true,
	noEmit: true,
	target: ts.ScriptTarget.ES2022,
	lib: ["lib.es2022.d.ts"],
	types: ["google-apps-script"],
};
const host = ts.createCompilerHost(options);
/** @param {string} fileName */
host.fileExists = fileName => fileName === virtualPath || ts.sys.fileExists(fileName);
/** @param {string} fileName */
host.readFile = fileName => (fileName === virtualPath ? source : ts.sys.readFile(fileName));

const program = ts.createProgram([virtualPath], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
	const output = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
		getCanonicalFileName: fileName => fileName,
		getCurrentDirectory: () => process.cwd(),
		getNewLine: () => "\n",
	});
	console.error(output.replaceAll("Code.gs.js", "Code.gs"));
	process.exitCode = 1;
}
