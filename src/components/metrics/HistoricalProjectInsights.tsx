import { useState } from "react";
import type { useTranslation } from "next-i18next";
import type { ProjectInsights } from "@root/private-metrics/project-insights";
import { AggregateInsights } from "./AggregateInsights";

type Translate = ReturnType<typeof useTranslation>["t"];
const percentage = (value: number, total: number, locale: string) =>
	total ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / total) : "—";

export const HistoricalProjectInsights = ({
	data,
	t,
	locale,
}: {
	data: ProjectInsights;
	t: Translate;
	locale: string;
}) => {
	const [dimension, setDimension] = useState("technologies");
	const [expanded, setExpanded] = useState(false);
	const rows =
		dimension === "teamSizes" ? data.teamSizes : dimension === "prizes" ? data.prizes.rows : data.technologies.rows;
	const answered =
		dimension === "teamSizes"
			? data.teamSizeAnsweredProjects
			: dimension === "prizes"
				? data.prizes.answeredProjects
				: data.technologies.answeredProjects;
	const suppressed =
		dimension === "teamSizes"
			? 0
			: dimension === "prizes"
				? data.prizes.suppressedLabels
				: data.technologies.suppressedLabels;
	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-4 sm:grid-cols-3">
				{(
					[
						["devpostRegistrants", data.registrants],
						["devpostSubmitters", data.submitters],
						["devpostSubmittedProjects", data.submittedProjects],
					] as const
				).map(([key, value]) => (
					<section className="ui-panel p-5" key={key}>
						<h2 className="font-rubik text-sm">{t(key)}</h2>
						<p className="mt-2 font-coolvetica text-3xl">{value}</p>
					</section>
				))}
			</div>
			<section className="ui-panel p-5 font-rubik">
				<h2 className="font-coolvetica text-xl">{t("history.project.conversion")}</h2>
				<p className="mt-2 text-3xl tabular-nums">{percentage(data.submitters, data.registrants, locale)}</p>
				<p className="mt-2 text-sm">
					{t("history.project.conversionCounts", {
						from: data.registrants,
						to: data.submitters,
						gap: data.registrants - data.submitters,
					})}
				</p>
				<p className="mt-2 text-sm">{t("history.project.populationNote")}</p>
				<p className="mt-3 text-sm">{t("projectStatuses", data)}</p>
			</section>
			<section className="ui-panel p-5 font-rubik">
				<label className="flex max-w-md flex-col gap-1 text-sm">
					{t("dimensionLabel")}
					<select
						className="rounded border border-gray-400 bg-white p-2"
						value={dimension}
						onChange={event => {
							setDimension(event.target.value);
							setExpanded(false);
						}}
					>
						{["technologies", "teamSizes", "prizes"].map(key => (
							<option key={key} value={key}>
								{t(`history.project.${key}`)}
							</option>
						))}
					</select>
				</label>
				<h2 className="mt-5 font-coolvetica text-xl">{t(`history.project.${dimension}`)}</h2>
				<p className="mt-2 text-sm">
					{t("history.project.base", {
						total: data.submittedProjects,
						answered,
						missing: data.submittedProjects - answered,
					})}
				</p>
				{dimension !== "teamSizes" && <p className="mt-2 text-sm">{t("history.project.overlap")}</p>}
				{dimension === "teamSizes" && (
					<AggregateInsights rows={rows} total={data.submittedProjects} dimension={dimension} t={t} />
				)}
				<ul className="mt-5 space-y-4">
					{(expanded ? rows : rows.slice(0, 10)).map(row => (
						<li key={row.label}>
							<div className="flex items-start justify-between gap-3 text-sm">
								<span className="break-words">
									{row.label === "Other / suppressed" ? t("history.project.other") : row.label}
								</span>
								<span className="shrink-0 tabular-nums">
									{row.value} · {percentage(row.value, data.submittedProjects, locale)}
								</span>
							</div>
							<div className="mt-1 h-2 rounded bg-gray-200" aria-hidden>
								<div
									className="h-full rounded bg-teal-700"
									style={{
										width: `${data.submittedProjects ? (row.value / data.submittedProjects) * 100 : 0}%`,
									}}
								/>
							</div>
						</li>
					))}
				</ul>
				{!rows.length && <p className="mt-4 text-sm">{t("history.project.noCategories")}</p>}
				{rows.length > 10 && (
					<button type="button" className="ui-button mt-4" onClick={() => setExpanded(!expanded)}>
						{t(expanded ? "showTop" : "showAll", { count: rows.length })}
					</button>
				)}
				{suppressed > 0 && (
					<p className="mt-3 text-sm">{t("history.project.suppression", { count: suppressed })}</p>
				)}
			</section>
			<section className="ui-panel p-5 font-rubik">
				<h2 className="font-coolvetica text-xl">{t("history.project.completeness")}</h2>
				<p className="mt-2 text-sm">
					{t(
						data.sourceMethod === "organizer-pages"
							? "history.project.pageCoverageNote"
							: "history.project.completenessNote",
					)}
				</p>
				<dl className="mt-4 grid gap-4 sm:grid-cols-2">
					{data.coverage.map(row => (
						<div key={row.key}>
							<dt className="text-sm">{t(`history.project.coverage.${row.key}`)}</dt>
							<dd className="mt-1 text-xl tabular-nums">
								{row.answeredProjects === null ? (
									<span className="text-sm">{t("history.project.notAvailable")}</span>
								) : (
									<>
										{row.answeredProjects}/{data.submittedProjects} ·{" "}
										{percentage(row.answeredProjects, data.submittedProjects, locale)}
									</>
								)}
							</dd>
						</div>
					))}
				</dl>
			</section>
			<details className="ui-panel p-5 font-rubik text-sm">
				<summary className="cursor-pointer">{t("history.project.definitions")}</summary>
				<p className="mt-3">
					{t(
						data.sourceMethod === "organizer-pages"
							? "history.project.pageTeamNote"
							: "history.project.teamNote",
						{
							memberships: data.teamMemberships,
							people: data.submitters,
							answered: data.teamSizeAnsweredProjects,
						},
					)}
				</p>
				<p className="mt-3">{t("history.project.method")}</p>
				<p className="mt-3">
					{t(
						data.sourceMethod === "organizer-pages"
							? "history.project.pageSource"
							: "history.project.source",
						{
							date: new Intl.DateTimeFormat(locale, {
								dateStyle: "medium",
								timeStyle: "short",
								timeZone: "America/Toronto",
							}).format(new Date(data.capturedAt)),
							requests: data.teamUpRequests,
							duplicates: data.duplicateExportRows,
						},
					)}
				</p>
			</details>
		</div>
	);
};

type Participation = Pick<ProjectInsights, "registrants" | "submitters" | "submittedProjects" | "draftProjects">;
export const ProjectEditionComparison = ({
	editions,
	t,
}: {
	editions: { label: string; data: Participation }[];
	t: Translate;
}) => (
	<section className="mt-6 border-t border-gray-200 pt-5">
		<h3 className="font-coolvetica text-xl">{t("history.project.comparison")}</h3>
		<p className="mt-2 font-rubik text-sm">{t("history.project.populationNote")}</p>
		<div className="mt-4 overflow-x-auto font-rubik text-sm">
			<table className="w-full text-left">
				<thead>
					<tr>
						<th scope="col" className="p-3">
							{t("history.project.metric")}
						</th>
						{editions.map(edition => (
							<th key={edition.label} scope="col" className="whitespace-nowrap p-3">
								{edition.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{(
						[
							["devpostRegistrants", "registrants"],
							["devpostSubmitters", "submitters"],
							["devpostSubmittedProjects", "submittedProjects"],
							["history.project.drafts", "draftProjects"],
						] as const
					).map(([label, key]) => (
						<tr className="border-t border-gray-200" key={key}>
							<th scope="row" className="p-3 font-normal">
								{t(label)}
							</th>
							{editions.map(edition => (
								<td className="p-3 tabular-nums" key={edition.label}>
									{edition.data[key]}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	</section>
);
