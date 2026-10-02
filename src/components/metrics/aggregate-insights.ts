export type AggregateRow = { label: string; value: number };
const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const countries = new Map<string, string>();
for (const locale of ["en", "fr"]) {
	const names = new Intl.DisplayNames(locale, { type: "region" });
	for (const first of "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
		for (const second of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
			const code = first + second;
			const name = names.of(code);
			if (name && name !== code) {
				countries.set(normalize(name), code);
				countries.set(code.toLowerCase(), code);
			}
		}
}
for (const alias of ["usa", "u.s.a.", "united states of america"]) countries.set(alias, "US");
countries.set("uk", "GB");

// A city alone is not evidence of a country (e.g. London). Only an explicit
// country name/code or a country-qualified final segment is classified.
export const geographicRegion = (label: string, travel = false): "canada" | "outside" | "unknown" => {
	const normalized = normalize(label);
	if (normalized === "outside canada") return "outside";
	if (normalized === "canada") return "canada";
	if (["other / suppressed", "not provided", "n/a", "no", "non", "none", "in person"].includes(normalized))
		return "unknown";
	const code = countries.get(travel ? (normalized.split(",").at(-1)?.trim() ?? "") : normalized);
	// CA in free-form travel text can also mean California: require its full name.
	if (travel && normalized.split(",").at(-1)?.trim() === "ca") return "unknown";
	return code ? (code === "CA" ? "canada" : "outside") : "unknown";
};

export const outsideCanadaBounds = (rows: AggregateRow[], travel = false) => {
	let lower = 0;
	let unknown = 0;
	for (const row of rows) {
		const region = geographicRegion(row.label, travel);
		if (region === "outside") lower += row.value;
		else if (region === "unknown" && !["Not provided", "Missing"].includes(row.label)) unknown += row.value;
	}
	return { lower, upper: lower + unknown };
};

// A small pooled total is already in the source, but don't turn it into a new
// precise derived subgroup or percentage. Multi-select pools count mentions.
export const pooledInsight = (rows: AggregateRow[], total: number, multiSelect = false) => {
	const value = rows.find(row => row.label === "Other / suppressed")?.value ?? 0;
	return value >= 5
		? { value, share: !multiSelect && total > 0 ? Math.round((value / total) * 1000) / 10 : null }
		: null;
};
