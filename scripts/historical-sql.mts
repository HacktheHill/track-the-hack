// Parse dump literals without executing SQL or restoring credentials into a DB.
// Only explicitly selected columns survive into this local analysis process.
export type SqlRow = Record<string, string | number | null>;
const sqlEscapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0" };
export function readSqlTables(sql: string, projection: Record<string, string[]>): Record<string, SqlRow[]> {
	const columns = new Map<string, string[]>();
	for (const match of sql.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE/g))
		columns.set(
			match[1] ?? "",
			Array.from((match[2] ?? "").matchAll(/^\s*`([^`]+)`/gm), column => column[1] ?? ""),
		);
	const tables: Record<string, SqlRow[]> = Object.fromEntries(Object.keys(projection).map(key => [key, []]));
	const inserts = /INSERT INTO `([^`]+)`\s*(\([^;]*?\))?\s*VALUES\s*/g;
	let match: RegExpExecArray | null;
	while ((match = inserts.exec(sql))) {
		const table = match[1] ?? "";
		const names = match[2]
			? Array.from(match[2].matchAll(/`([^`]+)`/g), field => field[1] ?? "")
			: columns.get(table);
		let position = inserts.lastIndex;
		let quote = "";
		let token = "";
		let quoted = false;
		let values: Array<string | number | null> = [];
		const finish = () => {
			const value = token.trim();
			values.push(
				quoted ? token : value === "NULL" ? null : Number.isFinite(Number(value)) ? Number(value) : value,
			);
			token = "";
			quoted = false;
		};
		for (; position < sql.length; position++) {
			const char = sql[position] ?? "";
			if (quote) {
				if (char === "\\") {
					const escaped = sql[++position] ?? "";
					token += sqlEscapes[escaped] ?? escaped;
				} else if (char === quote && sql[position + 1] === quote) {
					token += quote;
					position++;
				} else if (char === quote) quote = "";
				else token += char;
			} else if (char === "'" || char === '"') {
				quote = char;
				quoted = true;
				token = "";
			} else if (char === "(") {
				values = [];
				token = "";
			} else if (char === ",") {
				if (token.trim() || quoted) finish();
			} else if (char === ")") {
				finish();
				if (projection[table]) {
					if (!names || names.length !== values.length) throw new Error(`Invalid tuple width in ${table}`);
					const row: SqlRow = {};
					for (const field of projection[table] ?? []) row[field] = values[names.indexOf(field)] ?? null;
					tables[table]?.push(row);
				}
				values = [];
				token = "";
			} else if (char === ";") break;
			else if (quoted) {
				/* discard whitespace after a quoted literal */
			} else token += char;
		}
		if (quote) throw new Error(`Unclosed SQL literal in ${table}`);
		inserts.lastIndex = position + 1;
	}
	return tables;
}
