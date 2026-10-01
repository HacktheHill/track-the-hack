export const answerCoverage = (rows: Array<{ label: string; applicants: number }>, total: number) => {
	const explicitMissing = rows.find(row => row.label === "Not provided");
	const suppressed = rows.find(row => row.label === "Other / suppressed")?.applicants ?? 0;
	// A small missing-answer category may have been pooled. Its absence is not
	// evidence of complete answers, so report a range rather than inventing 100%.
	const uncertain = !explicitMissing && suppressed > 0;
	const missing = explicitMissing?.applicants ?? (uncertain ? null : 0);
	const upper = total > 0 ? Math.round(((total - (missing ?? 0)) / total) * 1000) / 10 : null;
	const lower = total > 0 ? Math.max(0, Math.round(((total - (missing ?? suppressed)) / total) * 1000) / 10) : null;
	return { missing, suppressed, rate: upper === null ? "—" : uncertain ? `${lower ?? 0}–${upper}%` : `${upper}%` };
};
