import { useState } from "react";
import type { useTranslation } from "next-i18next";

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
export const CountBars = ({ rows }: { rows: Array<{ label: string; value: number }> }) => {
	const maximum = Math.max(1, ...rows.map(row => row.value));
	return (
		<ul className="mt-5 space-y-4 font-rubik">
			{rows.map(row => (
				<li key={row.label}>
					<div className="mb-1 flex items-start justify-between gap-4 text-sm">
						<span className="min-w-0 break-words">{row.label}</span>
						<span className="shrink-0 tabular-nums">{row.value}</span>
					</div>
					<div aria-hidden="true" className="h-3 overflow-hidden rounded bg-gray-200">
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
	const visible = showAll ? entries : entries.slice(0, 10);
	const rate = (from: number, to: number, label: string) =>
		from < 5 || label === "Other / suppressed" ? "—" : `${Math.round((to / from) * 1000) / 10}% (${to}/${from})`;
	return (
		<section className="ui-panel mt-4 p-5">
			<div className="flex flex-wrap gap-4 font-rubik">
				<label className="flex min-w-0 flex-1 flex-col gap-2">
					{t("dimensionLabel")}
					<select
						className="min-w-0 rounded border border-gray-400 bg-white p-2"
						value={selected}
						onChange={event => {
							setDimension(event.target.value);
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
				<label className="flex flex-col gap-2">
					{t("cohortLabel")}
					<select
						className="rounded border border-gray-400 bg-white p-2"
						value={cohort}
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
				<label className="flex flex-col gap-2">
					{t("displayLabel")}
					<select
						className="rounded border border-gray-400 bg-white p-2"
						value={mode}
						onChange={event => setMode(event.target.value)}
					>
						<option value="counts">{t("countView")}</option>
						<option value="conversion">{t("conversionView")}</option>
					</select>
				</label>
			</div>
			<h3 className="mt-6 font-coolvetica text-xl">{t(`dimension.${selected}`)}</h3>
			{selected === "acquisitionChannel" && <p className="mt-2 font-rubik text-sm">{t("multiSelectNote")}</p>}
			{mode === "counts" && (
				<CountBars rows={visible.map(entry => ({ label: entry.label, value: entry[cohort] }))} />
			)}
			{mode === "conversion" && <p className="mt-3 font-rubik text-sm">{t("cohortConversionNote")}</p>}
			{entries.length > 10 && (
				<button type="button" className="ui-button mt-4" onClick={() => setShowAll(!showAll)}>
					{t(showAll ? "showTop" : "showAll", { count: entries.length })}
				</button>
			)}
			<details className="mt-5" open={mode === "conversion"}>
				<summary className="cursor-pointer font-rubik">{t("exactValues")}</summary>
				<div className="mt-3 overflow-x-auto">
					<table className="w-full text-left font-rubik text-sm">
						<thead>
							<tr>
								<th className="p-3">{t("categoryLabel")}</th>
								{(mode === "counts"
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
							{visible.map(entry => (
								<tr key={entry.label} className="border-t border-gray-200">
									<th scope="row" className="min-w-[12rem] p-3 font-normal">
										{entry.label}
									</th>
									{(mode === "counts"
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
