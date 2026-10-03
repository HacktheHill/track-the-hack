import type { ArchiveDashboard } from "./snapshot";

export type CoverageStatus = "available" | "notCollected" | "notRecovered" | "excluded";
// Topic-level parity with the corrected PDFs, not a claim that different
// collection systems measured identical populations or every PDF cell.
export const reportCoverage = (
	snapshot: Pick<ArchiveDashboard, "history" | "participantBackground" | "projectInsights"> & {
		metrics: {
			attendanceData: unknown[];
			externalMetrics: { sheet: { payload: { dimensions: Record<string, unknown> } } | null };
		};
	},
) => {
	const historical = (id: "i" | "ii", key: string) =>
		snapshot.history?.editions.find(e => e.id === id)?.dimensions.some(d => d.key === key) ?? false;
	const current = (key: string) => Boolean(snapshot.metrics.externalMetrics.sheet?.payload.dimensions[key]);
	const status = (present: boolean): CoverageStatus => (present ? "available" : "notRecovered");
	const dimensions = [
		["education", "school"],
		["geography", "travelOrigin"],
		["gender", "gender"],
		["experience", "priorHackathon"],
		["logistics", "tShirtSize"],
		["profiles", "profileAvailability"],
	] as const;
	return [
		...dimensions.map(([key, dimension]) => ({
			key,
			i: status(historical("i", key === "experience" ? "priorHackathonCount" : dimension)),
			ii: status(historical("ii", dimension)),
			iii: status(current(dimension)),
		})),
		{
			key: "age",
			i: "notCollected" as const,
			ii: status(historical("ii", "age")),
			iii: status(Boolean(snapshot.participantBackground)),
		},
		{
			key: "race",
			i: "notCollected" as const,
			ii: status(historical("ii", "racialOrEthnicBackground")),
			iii: status(current("racialOrEthnicBackground")),
		},
		{
			key: "channels",
			i: "notCollected" as const,
			ii: status(historical("ii", "acquisitionChannel")),
			iii: status(current("acquisitionChannel")),
		},
		{
			key: "skills",
			i: "notCollected" as const,
			ii: status(historical("ii", "programmingLanguages")),
			iii: status(current("programmingLanguages")),
		},
		{
			key: "graduation",
			i: status(historical("i", "graduationYear")),
			ii: "notCollected" as const,
			iii: "notCollected" as const,
		},
		{
			key: "transport",
			i: status(historical("i", "transportSchools")),
			ii: "notCollected" as const,
			iii: "notCollected" as const,
		},
		{
			key: "formDuration",
			i: status(
				Boolean(snapshot.history?.editions.find(e => e.id === "i")?.stats.some(s => s.key === "timedForms")),
			),
			ii: "notCollected" as const,
			iii: "notCollected" as const,
		},
		{
			key: "activity",
			i: "notRecovered" as const,
			ii: status(Boolean(snapshot.history?.editions.find(e => e.id === "ii")?.events.length)),
			iii: status(snapshot.metrics.attendanceData.length > 0),
		},
		{
			key: "projects",
			i: status(Boolean(snapshot.history?.editions.find(e => e.id === "i")?.devpost)),
			ii: status(Boolean(snapshot.history?.editions.find(e => e.id === "ii")?.devpost)),
			iii: status(Boolean(snapshot.projectInsights)),
		},
		{
			key: "platform",
			i: "notRecovered" as const,
			ii: status(historical("ii", "staffRoles")),
			iii: "notRecovered" as const,
		},
		{ key: "timing", i: "excluded" as const, ii: "excluded" as const, iii: "excluded" as const },
	];
};
