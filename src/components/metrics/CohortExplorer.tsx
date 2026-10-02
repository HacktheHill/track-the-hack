import { useState } from "react";
import type { useTranslation } from "next-i18next";
import { AggregateInsights } from "./AggregateInsights";

type Breakdown = { label: string; applicants: number; accepted: number; confirmed: number; attended: number };
type Translate = ReturnType<typeof useTranslation>["t"];
const cohorts = ["applicants", "accepted", "confirmed", "attended"] as const;
const groups = {
	demographics: ["preferredLanguage", "age", "gender", "racialOrEthnicBackground", "priorHackathon"],
	education: ["studyLevel", "school", "areaOfStudy"],
	geography: ["country", "travelOrigin"],
	acquisition: ["acquisitionChannel"],
};

// Native bars keep long labels readable on small screens and avoid chart
// animations or remounts during background data refreshes.
export const CountBars = ({
	rows,
	total,
	suffix = "",
}: {
	rows: Array<{ label: string; value: number }>;
	total?: number;
	suffix?: string;
}) => {
	const maximum = Math.max(1, ...rows.map(row => row.value));
	return (
		<ul className="mt-4 space-y-3 font-rubik">
			{rows.map((row, index) => (
				<li key={`${row.label}-${index}`}>
					<div className="mb-1 flex items-start justify-between gap-4 text-sm">
						<span className="min-w-0 break-words">{row.label}</span>
						<span className="shrink-0 tabular-nums">
							{row.value}
							{suffix}
							{total !== undefined && total > 0
								? ` · ${Math.round((row.value / total) * 1000) / 10}%`
								: ""}
						</span>
					</div>
					<div aria-hidden="true" className="h-2 overflow-hidden rounded bg-gray-200">
						<div
							className="h-full rounded bg-orange-600"
							style={{ width: `${(row.value / maximum) * 100}%` }}
						/>
					</div>
				</li>
			))}
		</ul>
	);
};

export const CohortExplorer = ({ dimensions, t }: { dimensions: Record<string, Breakdown[]>; t: Translate }) => {
	const keys = Object.keys(dimensions);
	const [dimension, setDimension] = useState(keys[0] ?? "");
	const [cohort, setCohort] = useState<(typeof cohorts)[number]>("attended");
	const [showAll, setShowAll] = useState(false);
	const [mode, setMode] = useState("counts");
	const selected = keys.includes(dimension) ? dimension : (keys[0] ?? "");
	const entries = [...(dimensions[selected] ?? [])].sort(
		(a, b) => b[cohort] - a[cohort] || a.label.localeCompare(b.label),
	);
	const coverage = entries.filter(entry => ["Not provided", "Other / suppressed"].includes(entry.label));
	const ranked = entries.filter(
		entry => !coverage.includes(entry) && (mode === "comparison" ? entry.applicants > 0 : entry[cohort] > 0),
	);
	const visible = showAll ? ranked : ranked.slice(0, 10);
	const rate = (from: number, to: number, label: string) =>
		from < 5 || label === "Other / suppressed" ? "—" : `${Math.round((to / from) * 1000) / 10}% (${to}/${from})`;
	return (
		<section className="ui-panel p-4 sm:p-5">
			<div className="flex flex-wrap gap-3 font-rubik text-sm">
				<label className="flex min-w-[10rem] flex-1 flex-col gap-1">
					{t("dimensionLabel")}
					<select
						className="min-w-0 rounded border border-gray-400 bg-white p-2"
						value={selected}
						onChange={event => {
							setDimension(event.target.value);
							if (event.target.value === "acquisitionChannel" && mode === "comparison") setMode("counts");
							setShowAll(false);
						}}
					>
						{Object.entries(groups).map(([group, members]) => (
							<optgroup key={group} label={t(`group.${group}`)}>
								{members
									.filter(key => keys.includes(key))
									.map(key => (
										<option key={key} value={key}>
											{t(`dimension.${key}`)}
										</option>
									))}
							</optgroup>
						))}
						{keys
							.filter(key => !Object.values(groups).flat().includes(key))
							.map(key => (
								<option key={key} value={key}>
									{t(`dimension.${key}`)}
								</option>
							))}
					</select>
				</label>
				<label className="flex flex-col gap-1">
					{t("cohortLabel")}
					<select
						className="rounded border border-gray-400 bg-white p-2"
						value={cohort}
						disabled={mode === "comparison"}
						onChange={event => {
							const value = event.target.value;
							const selectedCohort = cohorts.find(key => key === value);
							if (selectedCohort) setCohort(selectedCohort);
						}}
					>
						{cohorts.map(key => (
							<option key={key} value={key}>
								{t(`cohort.${key}`)}
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1">
					{t("displayLabel")}
					<select
						className="rounded border border-gray-400 bg-white p-2"
						value={mode}
						onChange={event => setMode(event.target.value)}
					>
						<option value="counts">{t("countView")}</option>
						<option value="conversion">{t("conversionView")}</option>
						{selected !== "acquisitionChannel" && <option value="comparison">{t("comparisonView")}</option>}
					</select>
				</label>
			</div>
			<h2 className="mt-5 font-coolvetica text-xl">
				{t(`dimension.${selected}`)} · {t(mode === "comparison" ? "comparisonView" : `cohort.${cohort}`)}
			</h2>
			{selected === "acquisitionChannel" && <p className="mt-2 font-rubik text-sm">{t("multiSelectNote")}</p>}
			<AggregateInsights
				populationLabel={t(`cohort.${cohort}`)}
				rows={entries.map(entry => ({ label: entry.label, value: entry[cohort] }))}
				total={entries.reduce((sum, entry) => sum + entry[cohort], 0)}
				dimension={selected}
				multiSelect={selected === "acquisitionChannel"}
				t={t}
			/>
			{mode === "counts" && (
				<CountBars
					rows={visible.map(entry => ({ label: entry.label, value: entry[cohort] }))}
					total={
						selected === "acquisitionChannel"
							? undefined
							: entries.reduce((sum, entry) => sum + entry[cohort], 0)
					}
				/>
			)}
			{mode === "comparison" && selected !== "acquisitionChannel" && (
				<ComparisonBars
					rows={visible}
					totals={{
						applicants: entries.reduce((sum, row) => sum + row.applicants, 0),
						attended: entries.reduce((sum, row) => sum + row.attended, 0),
					}}
					t={t}
				/>
			)}
			{mode === "counts" && ranked.length === 0 && (
				<p className="mt-3 font-rubik text-sm">{t("noCategoryCounts")}</p>
			)}
			{coverage.length > 0 && (
				<aside className="mt-4 rounded border border-gray-200 bg-gray-50 p-3 font-rubik text-sm">
					<h3 className="font-medium">{t("answerCoverage")}</h3>
					<dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
						{coverage.map(entry => (
							<div key={entry.label} className="flex flex-wrap gap-x-2">
								<dt>
									{t(entry.label === "Not provided" ? "notProvidedCategory" : "suppressedCategory")}
								</dt>
								<dd className="tabular-nums">
									{mode === "comparison"
										? `${t("cohort.applicants")}: ${entry.applicants} · ${t("cohort.attended")}: ${entry.attended}`
										: entry[cohort]}
								</dd>
							</div>
						))}
					</dl>
				</aside>
			)}
			{mode === "conversion" && <p className="mt-3 font-rubik text-sm">{t("cohortConversionNote")}</p>}
			{mode !== "conversion" && ranked.length > 10 && (
				<button type="button" className="ui-button mt-4" onClick={() => setShowAll(!showAll)}>
					{t(showAll ? "showTop" : "showAll", { count: ranked.length })}
				</button>
			)}
			<details className="mt-5" open={mode === "conversion"}>
				<summary className="cursor-pointer font-rubik">{t("exactValues")}</summary>
				<p className="mt-3 font-rubik text-sm">
					{t("demographicsDescription")} {t("zeroCountsNote")}
				</p>
				<div className="mt-3 overflow-x-auto">
					<table className="w-full text-left font-rubik text-sm">
						<thead>
							<tr>
								<th className="p-3">{t("categoryLabel")}</th>
								{(mode !== "conversion"
									? cohorts.map(key => t(`cohort.${key}`))
									: [t("applicationToAccepted"), t("acceptedToConfirmed"), t("acceptedToAttended")]
								).map(label => (
									<th key={label} className="p-3">
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{entries.map(entry => (
								<tr key={entry.label} className="border-t border-gray-200">
									<th scope="row" className="min-w-[12rem] p-3 font-normal">
										{entry.label}
									</th>
									{(mode !== "conversion"
										? cohorts.map(key => entry[key])
										: [
												rate(entry.applicants, entry.accepted, entry.label),
												rate(entry.accepted, entry.confirmed, entry.label),
												rate(entry.accepted, entry.attended, entry.label),
											]
									).map((value, index) => (
										<td key={index} className="whitespace-nowrap p-3 tabular-nums">
											{value}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</section>
	);
};

export const ComparisonBars = ({
	rows,
	totals,
	t,
}: {
	rows: Breakdown[];
	totals: { applicants: number; attended: number };
	t: Translate;
}) => (
	<div className="mt-4 font-rubik text-sm">
		<p>{t("comparisonNote")}</p>
		<div className="mt-2 flex flex-wrap gap-4">
			<span className="text-orange-800">
				{t("cohort.applicants")} · n={totals.applicants}
			</span>
			<span className="text-teal-800">
				{t("cohort.attended")} · n={totals.attended}
			</span>
		</div>
		<ul className="mt-4 space-y-5">
			{rows.map(row => (
				<li key={row.label}>
					<p className="mb-2 break-words font-medium">{row.label}</p>
					{(["applicants", "attended"] as const).map(cohort => {
						const share =
							totals[cohort] > 0 ? Math.round((row[cohort] / totals[cohort]) * 1000) / 10 : null;
						return (
							<div key={cohort} className="mb-1 flex items-center gap-3">
								<span className="w-28 shrink-0 text-xs">{t(`cohort.${cohort}`)}</span>
								<div aria-hidden className="h-2 flex-1 rounded bg-gray-200">
									<div
										className={`h-full rounded ${cohort === "applicants" ? "bg-orange-600" : "bg-teal-700"}`}
										style={{ width: `${share ?? 0}%` }}
									/>
								</div>
								<span className="w-24 shrink-0 text-right tabular-nums">
									{row[cohort]} · {share === null ? "—" : `${share}%`}
								</span>
							</div>
						);
					})}
				</li>
			))}
		</ul>
	</div>
);
