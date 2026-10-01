import { useState } from "react";
import type { useTranslation } from "next-i18next";
import type { HistoricalArchive, HistoricalEdition } from "@root/private-metrics/history";
import type { DashboardData } from "@root/private-metrics/snapshot";
import { CountBars } from "./CohortExplorer";
import styles from "@/pages/metrics/Metrics.module.css";
import { shirtSizeOrder } from "@root/private-metrics/operations";
import { ProjectEditionComparison } from "./HistoricalProjectInsights";

type Translate = ReturnType<typeof useTranslation>["t"];
const source = "https://github.com/HacktheHill/prev-hackathon-analysis/tree/main/corrected_version";
const Card = ({ label, value, note }: { label: string; value: number | string; note?: string }) => (
	<section className={`ui-panel p-4 ${styles.card ?? ""}`}>
		<h2 className="font-rubik">{label}</h2>
		<p className={styles.number}>{value}</p>
		{note && <p className="mt-2 font-rubik text-sm">{note}</p>}
	</section>
);

export const HistoricalMetrics = ({ edition, view, t }: { edition: HistoricalEdition; view: string; t: Translate }) => {
	const dimensions = edition.dimensions.filter(
		dimension => dimension.section === view && dimension.key !== "loginProviders",
	);
	const [dimension, setDimension] = useState("");
	const [showAll, setShowAll] = useState(false);
	const selected = dimensions.find(row => row.key === dimension) ?? dimensions[0];
	const selectedRows =
		selected?.key === "tShirtSize"
			? [...selected.rows].sort((a, b) => shirtSizeOrder(a.label) - shirtSizeOrder(b.label))
			: selected?.key === "teamSizes"
				? [...selected.rows].sort((a, b) => Number(a.label) - Number(b.label))
				: selected?.rows.slice().sort((a, b) => b.value - a.value);
	const stats = edition.stats.filter(stat =>
		view === "operations"
			? ["transportRequested", "onlineOnly", "accommodationResponses", "scheduledEvents", "foodPeople"].includes(
					stat.key,
				)
			: ![
					"transportRequested",
					"onlineOnly",
					"accommodationResponses",
					"scheduledEvents",
					"foodPeople",
					"platformAccounts",
					"staffPeople",
					"staffAssignments",
				].includes(stat.key),
	);
	return (
		<div className="flex flex-col gap-6">
			{view === "overview" && (
				<>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{(["registrations", "preEvent", "walkIns", "checkIn"] as const).map(key => (
							<Card
								key={key}
								label={t(`history.population.${key}`)}
								value={edition.populations[key]}
								note={t(`history.${edition.id}.populationNote.${key}`)}
							/>
						))}
					</div>
					<section className="ui-panel p-5">
						<h2 className="font-coolvetica text-2xl">{t("funnelTitle")}</h2>
						<p className="mt-2 font-rubik text-sm">{t(`history.${edition.id}.funnelNote`)}</p>
						<div
							className={`mt-4 grid gap-4 sm:grid-cols-2 ${edition.funnel.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
						>
							{edition.funnel.map(stage => (
								<Card
									key={stage.key}
									label={t(stage.key)}
									value={stage.value}
									note={t(`history.unit.${stage.unit}`)}
								/>
							))}
						</div>
						<div className="mt-5 rounded border border-teal-200 bg-teal-50 p-4 font-rubik">
							<h3 className="font-medium">{t("confirmedToAttended")}</h3>
							<p className="mt-1 text-2xl tabular-nums">
								{edition.turnout.from
									? Math.round((edition.turnout.to / edition.turnout.from) * 1000) / 10
									: "—"}
								%
							</p>
							<p className="mt-2 text-sm">
								{t("history.matchedTurnout", {
									from: edition.turnout.from,
									to: edition.turnout.to,
									drop: edition.turnout.from - edition.turnout.to,
								})}
							</p>
							<p className="mt-2 text-sm">{t(`history.${edition.id}.turnoutNote`)}</p>
						</div>
					</section>
					{edition.id === "ii" && (
						<Card
							label={t("history.anyScan")}
							value={edition.populations.anyScan}
							note={t("history.anyScanNote")}
						/>
					)}
				</>
			)}
			{selected && (
				<section className="ui-panel p-5">
					<label className="flex max-w-md flex-col gap-1 font-rubik text-sm">
						{t("dimensionLabel")}
						<select
							className="rounded border border-gray-400 bg-white p-2"
							value={selected.key}
							onChange={event => {
								setDimension(event.target.value);
								setShowAll(false);
							}}
						>
							{dimensions.map(row => (
								<option key={row.key} value={row.key}>
									{t(`history.dimension.${row.key}`, { defaultValue: t(`dimension.${row.key}`) })}
								</option>
							))}
						</select>
					</label>
					<h2 className="mt-5 font-coolvetica text-xl">
						{t(`history.dimension.${selected.key}`, { defaultValue: t(`dimension.${selected.key}`) })}
					</h2>
					<p className="mt-2 font-rubik text-sm">
						{t(selected.key === "profileAvailability" ? "history.profileBase" : "history.dimensionBase", {
							total: selected.total,
							answered: selected.total - selected.missing,
							missing: selected.missing,
						})}
					</p>
					{selected.multiSelect && <p className="mt-2 font-rubik text-sm">{t("history.overlapNote")}</p>}
					{selected.key === "programmingLanguages" && (
						<details className="mt-2 font-rubik text-sm">
							<summary className="cursor-pointer">{t("history.languageMethodLabel")}</summary>
							<p className="mt-2">{t("history.languageMethod")}</p>
						</details>
					)}
					{(["school", "travelOrigin", "studyLevel", "areaOfStudy"].includes(selected.key) ||
						(edition.id === "ii" && selected.key.startsWith("dietary"))) && (
						<p className="mt-2 font-rubik text-sm">{t("history.rawCategoryNote")}</p>
					)}
					<CountBars
						rows={
							(showAll ? selectedRows : selectedRows?.slice(0, 10))?.map(row => ({
								...row,
								label:
									selected.key === "teamSizes"
										? t("history.teamSize", { count: Number(row.label) })
										: selected.key === "profileAvailability"
											? t(`history.profileLabel.${row.label}`, { defaultValue: row.label })
											: row.label === "Other / suppressed"
												? t("suppressedCategory")
												: row.label,
							})) ?? []
						}
						total={selected.multiSelect ? undefined : selected.total}
					/>
					{selected.rows.length > 10 && (
						<button type="button" className="ui-button mt-4" onClick={() => setShowAll(!showAll)}>
							{t(showAll ? "showTop" : "showAll", { count: selected.rows.length })}
						</button>
					)}
				</section>
			)}
			{view === "operations" && edition.events.length > 0 && (
				<>
					<p className="font-rubik text-sm">
						{t("history.eventBase", {
							any: edition.populations.anyScan,
							check: edition.populations.checkIn,
						})}
					</p>
					<p className="font-rubik text-sm">{t("history.repeatedLabels")}</p>
					{["FOOD", "WORKSHOP", "SOCIAL", "OTHER"].map(group => {
						const events = edition.events.filter(row =>
							group === "OTHER"
								? !["FOOD", "WORKSHOP", "SOCIAL"].includes(row.group)
								: row.group === group,
						);
						return events.length ? (
							<section className="ui-panel p-5" key={group}>
								<h2 className="font-coolvetica text-xl">{t(`history.eventGroup.${group}`)}</h2>
								<div className="mt-4 overflow-x-auto">
									<table className="w-full text-left font-rubik text-sm">
										<thead>
											<tr>
												{(group === "FOOD"
													? [
															"eventLabel",
															"history.people",
															"history.units",
															"history.perPerson",
															"history.withCheckIn",
															"history.instances",
														]
													: ["eventLabel", "history.people", "history.withCheckIn"]
												).map(key => (
													<th className="p-3" key={key}>
														{t(key)}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{events.map(event => (
												<tr className="border-t border-gray-200" key={event.label}>
													<th scope="row" className="min-w-48 p-3 font-normal">
														{event.label}
													</th>
													<td className="p-3">
														{event.people} ·{" "}
														{Math.round(
															(event.people / edition.populations.anyScan) * 1000,
														) / 10}
														%
													</td>
													{group === "FOOD" && (
														<>
															<td className="p-3">{event.units}</td>
															<td className="p-3">
																{event.people
																	? (event.units / event.people).toFixed(2)
																	: "—"}
															</td>
														</>
													)}
													<td className="p-3">
														{event.checkedInPeople} ·{" "}
														{Math.round(
															(event.checkedInPeople / edition.populations.checkIn) *
																1000,
														) / 10}
														%
													</td>
													{group === "FOOD" && (
														<td className="p-3">{event.instances || "—"}</td>
													)}
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>
						) : null;
					})}
				</>
			)}
			{["operations", "insights"].includes(view) && stats.length > 0 && (
				<section className="ui-panel p-5">
					<h2 className="font-coolvetica text-xl">
						{t(view === "operations" ? "history.logistics" : "history.background")}
					</h2>
					<dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{stats.map(stat => (
							<div key={stat.key}>
								<dt className="font-rubik text-sm">{t(`history.stat.${stat.key}`)}</dt>
								<dd className="mt-1 font-coolvetica text-2xl">
									{stat.value}
									{stat.unit !== "count" && ` ${t(`history.unit.${stat.unit}`)}`}
								</dd>
							</div>
						))}
					</dl>
					<p className="mt-4 font-rubik text-sm">
						{t(view === "operations" ? `history.${edition.id}.logisticsNote` : "history.insightNote")}
					</p>
				</section>
			)}
			{view === "operations" && edition.mealBounds.length > 0 && (
				<details className="ui-panel p-5 font-rubik text-sm">
					<summary className="cursor-pointer">{t("history.mealBounds")}</summary>
					<p className="mt-3">{t("history.mealBoundsNote")}</p>
					<div className="mt-3 overflow-x-auto">
						<table className="w-full text-left">
							<thead>
								<tr>
									{[
										"eventLabel",
										"history.firstSitting",
										"history.secondSitting",
										"history.floating",
										"history.units",
									].map(key => (
										<th key={key} className="p-3">
											{t(key)}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{edition.mealBounds.map(row => (
									<tr key={row.label} className="border-t border-gray-200">
										<th scope="row" className="p-3 font-normal">
											{row.label}
										</th>
										<td className="p-3">
											{row.firstMin}–{row.firstMax}
										</td>
										<td className="p-3">
											{row.secondMin}–{row.secondMax}
										</td>
										<td className="p-3">{row.floating}</td>
										<td className="p-3">{row.total}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</details>
			)}
			{view === "insights" && edition.id === "ii" && (
				<details className="ui-panel p-5 font-rubik">
					<summary className="cursor-pointer">{t("history.platform")}</summary>
					<dl className="mt-4 grid gap-5 sm:grid-cols-3">
						{edition.stats
							.filter(stat => ["platformAccounts", "staffPeople", "staffAssignments"].includes(stat.key))
							.map(stat => (
								<div key={stat.key}>
									<dt className="text-sm">{t(`history.stat.${stat.key}`)}</dt>
									<dd className="mt-1 text-2xl">{stat.value}</dd>
								</div>
							))}
					</dl>
					<p className="mt-4 text-sm">{t("history.staffNote")}</p>
					<CountBars
						rows={edition.dimensions.find(dimension => dimension.key === "loginProviders")?.rows ?? []}
					/>
				</details>
			)}
			{view === "quality" && (
				<>
					<section className="ui-panel p-5">
						<h2 className="font-coolvetica text-xl">{t("dataQualityTitle")}</h2>
						<dl className="mt-4 grid gap-5 sm:grid-cols-2">
							{edition.quality.map(row => (
								<div key={row.key}>
									<dt className="font-rubik text-sm">{t(`history.quality.${row.key}`)}</dt>
									<dd className="font-coolvetica text-2xl">{row.value}</dd>
								</div>
							))}
						</dl>
					</section>
					<section className="ui-panel p-5">
						<h2 className="font-coolvetica text-xl">{t("coverageByDimension")}</h2>
						<CountBars
							suffix="%"
							rows={[...edition.dimensions.filter(row => row.section === "cohorts")]
								.sort((a, b) => (a.total - a.missing) / a.total - (b.total - b.missing) / b.total)
								.map(row => ({
									label: `${t(`history.dimension.${row.key}`, { defaultValue: t(`dimension.${row.key}`) })} · ${row.total - row.missing}/${row.total}`,
									value: Math.round(((row.total - row.missing) / row.total) * 1000) / 10,
								}))}
						/>
						<p className="mt-3 font-rubik text-sm">{t("history.coverageNote")}</p>
					</section>
					<details className="ui-panel p-5 font-rubik" open={edition.id === "i"}>
						<summary className="cursor-pointer">{t("metricDefinitions")}</summary>
						<p className="mt-3 text-sm">{t(`history.${edition.id}.method`)}</p>
						<p className="mt-3 text-sm">{t("history.privacyNote")}</p>
						<a href={source} className="mt-3 inline-block text-sm underline">
							{t("correctedAnalysis")}
						</a>
					</details>
				</>
			)}
		</div>
	);
};

export const EditionComparison = ({
	history,
	current,
	t,
}: {
	history: HistoricalArchive;
	current: DashboardData;
	t: Translate;
}) => (
	<section className="ui-panel p-5">
		<h2 className="font-coolvetica text-2xl">{t("history.comparison")}</h2>
		<p className="mt-2 font-rubik text-sm">{t("history.comparisonNote")}</p>
		<div className="mt-4 grid gap-4 lg:grid-cols-3">
			{history.editions.map(edition => (
				<section key={edition.id} className="rounded border border-gray-200 p-4">
					<h3 className="font-coolvetica text-xl">
						Hack the Hill {edition.id.toUpperCase()} · {edition.year}
					</h3>
					<dl className="mt-4 space-y-4 font-rubik text-sm">
						<div>
							<dt>{t("history.registrationRows")}</dt>
							<dd className="text-xl">{edition.populations.registrations}</dd>
						</div>
						<div>
							<dt>{t("history.population.preEvent")}</dt>
							<dd className="text-xl">{edition.populations.preEvent}</dd>
						</div>
						<div>
							<dt>{t("confirmedToAttended")}</dt>
							<dd className="text-xl">
								{Math.round((edition.turnout.to / edition.turnout.from) * 1000) / 10}% ·{" "}
								{edition.turnout.to}/{edition.turnout.from}
							</dd>
						</div>
					</dl>
					<p className="mt-4 font-rubik text-sm">{t(`history.${edition.id}.turnoutNote`)}</p>
				</section>
			))}
			<section className="rounded border border-gray-200 p-4">
				<h3 className="font-coolvetica text-xl">Hack the Hill III</h3>
				<dl className="mt-4 space-y-4 font-rubik text-sm">
					<div>
						<dt>{t("qualifier.applications")}</dt>
						<dd className="text-xl">{current.funnel.applications ?? "—"}</dd>
					</div>
					<div>
						<dt>{t("provisioned")}</dt>
						<dd className="text-xl">{current.provisioned}</dd>
					</div>
					<div>
						<dt>{t("confirmedToAttended")}</dt>
						<dd className="text-xl">
							{current.conversions.participation.confirmedToAttended.rate ?? "—"}% ·{" "}
							{current.attendanceOutcomes.confirmedAttended}/{current.confirmed}
						</dd>
					</div>
				</dl>
				<p className="mt-4 font-rubik text-sm">{t("history.iii.turnoutNote")}</p>
			</section>
		</div>
		{history.editions.some(edition => edition.devpost) && (
			<ProjectEditionComparison
				t={t}
				editions={[
					...history.editions.flatMap(edition =>
						edition.devpost ? [{ label: `HTH ${edition.id.toUpperCase()}`, data: edition.devpost }] : [],
					),
					...(current.externalMetrics.devpost
						? [{ label: "HTH III", data: current.externalMetrics.devpost.payload }]
						: []),
				]}
			/>
		)}
	</section>
);
