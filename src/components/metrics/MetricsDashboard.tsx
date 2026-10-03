import { TShirtSize } from "@prisma/client";
import { useTranslation } from "next-i18next";
import { useState } from "react";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import { CohortExplorer, CountBars } from "@/components/metrics/CohortExplorer";
import { AnswerCoverage } from "@/components/metrics/AnswerCoverage";
import { HistoricalMetrics, EditionComparison } from "@/components/metrics/HistoricalMetrics";
import { HistoricalProjectInsights } from "@/components/metrics/HistoricalProjectInsights";
import type { HistoricalArchive } from "@root/private-metrics/history";
import type { ParticipantBackground } from "@root/private-metrics/background";
import type { ProjectInsights } from "@root/private-metrics/project-insights";
import { ParticipantBackgroundView } from "./ParticipantBackgroundView";
import { ReportCoverage } from "./ReportCoverage";
import { NormalizationQuality } from "./NormalizationQuality";
import { operationalEvents, shirtSizeOrder } from "@root/private-metrics/operations";
import type { DashboardData } from "@root/private-metrics/snapshot";
import styles from "@/pages/metrics/Metrics.module.css";

export const MetricsDashboard = ({
	data,
	updatedAt,
	fetching = false,
	loading = false,
	failed = false,
	onRefresh,
	archived = false,
	history,
	participantBackground,
	projectInsights,
}: {
	data?: DashboardData;
	updatedAt: number;
	fetching?: boolean;
	loading?: boolean;
	failed?: boolean;
	onRefresh?: () => void;
	archived?: boolean;
	history?: HistoricalArchive;
	participantBackground?: ParticipantBackground;
	projectInsights?: ProjectInsights;
}) => {
	const { t, i18n } = useTranslation("metrics");
	const [view, setView] = useState("overview");
	const [edition, setEdition] = useState("iii");
	const selectedEdition = history?.editions.find(item => item.id === edition);
	const lastUpdated = updatedAt
		? new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit" }).format(new Date(updatedAt))
		: null;
	const totals =
		data &&
		([
			["provisioned", data.provisioned, "provisionedDescription"],
			["walkIn", data.walkIn, "walkInDescription"],
		] as const);
	const funnel =
		data &&
		([
			["applications", data.funnel.applications, "applicationsDescription"],
			["accepted", data.funnel.accepted, "acceptedDescription"],
			["confirmed", data.funnel.confirmed, "confirmedDescription"],
			["checkedIn", data.funnel.checkedIn, "checkedInDescription"],
		] as const);
	const sheetSnapshot = data?.externalMetrics.sheet;
	const devpostSnapshot = data?.externalMetrics.devpost;

	return (
		<App className={`overflow-y-auto ${styles.dashboard ?? ""}`} integrated title={t("title")}>
			<div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<h1 className="ui-page-title">{t("title")}</h1>
						<p className="mt-2 font-rubik text-sm text-dark-color">
							{selectedEdition
								? view === "projects" && selectedEdition.devpost
									? t("history.project.sourceLabel", {
											date: new Intl.DateTimeFormat(i18n.language, {
												dateStyle: "medium",
												timeZone: "America/Toronto",
											}).format(new Date(selectedEdition.devpost.capturedAt)),
										})
									: t(`history.${selectedEdition.id}.sourceLabel`)
								: archived
									? t("archivedSnapshot", {
											date: new Intl.DateTimeFormat(i18n.language, {
												dateStyle: "medium",
											}).format(new Date(updatedAt)),
										})
									: lastUpdated
										? t("lastUpdated", { time: lastUpdated })
										: t("notUpdated")}
						</p>
					</div>
					{onRefresh && (
						<button type="button" className="ui-button" disabled={fetching} onClick={onRefresh}>
							{fetching ? t("refreshing") : t("refresh")}
						</button>
					)}
					{archived && history && (
						<label className="flex flex-col gap-1 font-rubik text-sm">
							{t("history.editionLabel")}
							<select
								className="rounded border border-gray-400 bg-white p-2"
								value={edition}
								onChange={event => {
									setEdition(event.target.value);
									if (view === "background" && event.target.value !== "iii") setView("insights");
									if (
										view === "projects" &&
										!(event.target.value === "iii"
											? projectInsights
											: history.editions.find(item => item.id === event.target.value)?.devpost)
									)
										setView("insights");
								}}
							>
								<option value="iii">Hack the Hill III</option>
								{history.editions.map(item => (
									<option key={item.id} value={item.id}>
										Hack the Hill {item.id.toUpperCase()} · {item.year}
									</option>
								))}
								<option value="comparison">{t("history.comparison")}</option>
							</select>
						</label>
					)}
				</div>
				{!data && loading && <Loading />}
				{failed && <Error message={t(data ? "refreshFailed" : "common:temporarily-unavailable")} />}
				<nav
					className={styles.tabs}
					aria-label={t("viewsLabel")}
					hidden={edition === "comparison"}
					style={edition === "comparison" ? { display: "none" } : undefined}
				>
					{[
						"overview",
						"cohorts",
						"operations",
						"quality",
						...(archived ? ["insights"] : []),
						...(selectedEdition?.devpost || (edition === "iii" && projectInsights) ? ["projects"] : []),
						...(edition === "iii" && participantBackground ? ["background"] : []),
					].map(key => (
						<button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
							{t(
								key === "projects"
									? "view.projects"
									: selectedEdition && key === "insights"
										? "history.insightsLabel"
										: `view.${key}`,
							)}
						</button>
					))}
				</nav>
				{archived && data && view === "quality" && (
					<ReportCoverage
						snapshot={{ metrics: data, history, participantBackground, projectInsights }}
						t={t}
					/>
				)}
				{selectedEdition && (
					<HistoricalMetrics edition={selectedEdition} view={view} t={t} locale={i18n.language} />
				)}
				{view === "quality" && edition !== "comparison" && (
					<NormalizationQuality
						rows={
							selectedEdition?.normalization ??
							(edition === "iii" ? participantBackground?.normalization : undefined)
						}
						t={t}
					/>
				)}
				{selectedEdition?.devpost && view === "projects" && (
					<HistoricalProjectInsights
						key={selectedEdition.id}
						data={selectedEdition.devpost}
						t={t}
						locale={i18n.language}
					/>
				)}
				{edition === "comparison" && history && data && (
					<EditionComparison history={history} current={data} t={t} />
				)}
				{data && edition === "iii" && (
					<>
						{view === "background" && participantBackground && (
							<ParticipantBackgroundView data={participantBackground} t={t} />
						)}
						{view === "projects" && projectInsights && (
							<HistoricalProjectInsights data={projectInsights} t={t} locale={i18n.language} />
						)}
						<div
							hidden={view !== "overview"}
							style={view !== "overview" ? { display: "none" } : undefined}
							className="flex flex-col gap-8"
						>
							<section>
								<h2 className="font-coolvetica text-2xl">{t("funnelTitle")}</h2>
								<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
									{funnel?.map(([key, value]) => (
										<MetricCard
											key={key}
											title={t(key)}
											value={value ?? t("unavailable")}
											description={t(`qualifier.${key}`)}
										/>
									))}
								</div>
								<div className="mt-4 grid gap-4 lg:grid-cols-3">
									<ConversionCard
										title={t("applicationToAccepted")}
										conversion={data.conversions.participation.applicationToAccepted}
										t={t}
									/>
									<ConversionCard
										title={t("acceptedToConfirmed")}
										conversion={data.conversions.participation.acceptedToConfirmed}
										t={t}
									/>
									<ConversionCard
										title={t("confirmedToAttended")}
										conversion={data.conversions.participation.confirmedToAttended}
										t={t}
									/>
								</div>
								<details className="mt-4 font-rubik text-sm">
									<summary className="cursor-pointer">{t("metricDefinitions")}</summary>
									<p className="mt-3">{t("funnelDescription")}</p>
									<dl className="mt-3 grid gap-3 sm:grid-cols-2">
										{funnel?.map(([key, , descriptionKey]) => (
											<div key={key}>
												<dt className="font-medium">{t(key)}</dt>
												<dd>{t(descriptionKey)}</dd>
											</div>
										))}
									</dl>
									<p className="mt-3">{t("attendanceOutcomesDescription")}</p>
								</details>
							</section>
							<section className="ui-panel p-5">
								<h2 className="font-coolvetica text-2xl">{t("attendanceOutcomesTitle")}</h2>
								<dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
									{Object.entries(data.attendanceOutcomes).map(([key, value]) => (
										<QualityMetric key={key} label={t(`outcome.${key}`)} value={value} />
									))}
								</dl>
								<p className="mt-4 font-rubik text-sm">{t("rsvpBreakdown", data.rsvp)}</p>
							</section>
							<section>
								<h2 className="font-coolvetica text-2xl">{t("communicationsTitle")}</h2>
								<div className="mt-4 grid gap-4 sm:grid-cols-2">
									<MetricCard
										title={t("acceptanceEmails")}
										value={data.funnel.acceptanceEmailsSesAccepted ?? t("unavailable")}
										description={t("acceptanceEmailsDescription")}
									/>
								</div>
							</section>
							{devpostSnapshot && <DevpostSection data={data} t={t} />}
						</div>
						<div
							hidden={view !== "quality"}
							style={view !== "quality" ? { display: "none" } : undefined}
							className="flex flex-col gap-8"
						>
							<DataQuality
								quality={data.dataQuality}
								uniqueApplicationEmails={devpostSnapshot?.payload.linkage?.uniqueApplicationEmails}
								t={t}
							/>
							{archived && sheetSnapshot && (
								<AnswerCoverage
									dimensions={sheetSnapshot.payload.dimensions}
									total={sheetSnapshot.payload.cohorts.applicants}
									t={t}
								/>
							)}
							{!archived && (
								<section className="ui-panel p-5">
									<QualityMetric
										label={t("judgingRosterProjects")}
										value={data.funnel.devpostProjects}
									/>
									<p className="mt-2 font-rubik text-sm">{t("devpostProjectsDescription")}</p>
								</section>
							)}
							<AttendanceIntegrity integrity={data.attendanceIntegrity} t={t} />
							<section className="ui-panel p-5">
								<h2 className="font-coolvetica text-xl">{t("sourceFreshness")}</h2>
								<dl className="mt-4 grid gap-4 sm:grid-cols-3">
									{Object.entries(data.externalMetrics).map(([key, snapshot]) => (
										<QualityMetric
											key={key}
											label={t(`source.${key}`)}
											value={
												snapshot
													? new Intl.DateTimeFormat(i18n.language, {
															dateStyle: "medium",
															timeStyle: "short",
														}).format(new Date(snapshot.capturedAt))
													: t("unavailable")
											}
										/>
									))}
								</dl>
							</section>
						</div>
						<div
							hidden={view !== "operations"}
							style={view !== "operations" ? { display: "none" } : undefined}
							className="flex flex-col gap-8"
						>
							<div className="grid gap-4 sm:grid-cols-2">
								{totals?.map(([key, value, descriptionKey]) => (
									<MetricCard
										key={key}
										title={t(key)}
										value={value}
										description={t(descriptionKey)}
									/>
								))}
							</div>
							<EventOperations data={data} locale={i18n.language} t={t} />
							<div className="grid items-start gap-6 lg:grid-cols-2">
								<OperationalChart
									title={t("eventEngagement")}
									description={t("eventEngagementDescription")}
									data={data.engagementData.map(entry => ({
										label: t(`engagement.${entry.key}`),
										participants: entry.participants,
									}))}
									x="label"
									y="participants"
									total={data.checkedIn}
									population={t("checkedIn")}
								/>
								<OperationalChart
									title={t("mealCategory")}
									description={t("mealCategoryDescription")}
									data={data.mealCategoryData}
									x="mealCategory"
									y="_count.mealCategory"
									total={data.provisioned}
									population={t("provisioned")}
								/>
								<OperationalChart
									title={t("tShirtSize")}
									description={t("tShirtSizeDescription")}
									data={[...data.tShirtSizeData]
										.sort((a, b) => shirtSizeOrder(a.tShirtSize) - shirtSizeOrder(b.tShirtSize))
										.map(entry => ({
											...entry,
											tShirtSize:
												entry.tShirtSize === TShirtSize.NONE
													? t("common:no-t-shirt")
													: entry.tShirtSize,
										}))}
									x="tShirtSize"
									y="_count.tShirtSize"
									total={data.provisioned}
									population={t("provisioned")}
								/>
							</div>
							<details className="ui-panel p-5">
								<summary className="cursor-pointer font-rubik">{t("serviceQuantities")}</summary>
								<p className="my-4 font-rubik text-sm">
									{t("presences")}: {data.presences}. {t("presencesDescription")}
								</p>
								<OperationalChart
									title={t("recordedUnits")}
									description={t("recordedUnitsDescription")}
									data={operationalEvents(data.attendanceData, i18n.language)}
									x="displayLabel"
									y="recordedUnits"
								/>
							</details>
						</div>
						<div hidden={view !== "cohorts"}>
							{sheetSnapshot && (
								<section>
									<CohortExplorer
										dimensions={sheetSnapshot.payload.dimensions}
										t={t}
										locale={i18n.language}
									/>
								</section>
							)}
							{!sheetSnapshot && <p>{t("unavailable")}</p>}
						</div>
						{archived && (
							<div hidden={view !== "insights"}>
								<ArchiveInsights data={data} t={t} />
							</div>
						)}
					</>
				)}
			</div>
		</App>
	);
};

const ArchiveInsights = ({ data, t }: { data: DashboardData; t: ReturnType<typeof useTranslation>["t"] }) => {
	const devpost = data.externalMetrics.devpost?.payload;
	const linkage = devpost?.linkage;
	return (
		<div className="flex flex-col gap-6">
			<section className="ui-panel p-5">
				<h2 className="font-coolvetica text-xl">{t("keyFindings")}</h2>
				<ul className="mt-3 list-disc space-y-2 pl-5 font-rubik text-sm">
					<li>
						{t("findingConfirmed", {
							count: data.attendanceOutcomes.confirmedAttended,
							total: data.confirmed,
							unmatched: data.attendanceOutcomes.attendedWithoutConfirmation,
						})}
					</li>
					<li>
						{t("findingLinkage", {
							count: data.dataQuality.sheetUnlinkedRows ?? "—",
							total: data.dataQuality.sheetRows ?? "—",
						})}
					</li>
				</ul>
			</section>
			<section className="ui-panel p-5">
				<h2 className="font-coolvetica text-2xl">{t("projectLinkageTitle")}</h2>
				<p className="mt-2 font-rubik text-sm">{t("projectLinkageNote")}</p>
				{linkage && (
					<div className="mt-4 overflow-x-auto">
						<table className="w-full text-left font-rubik text-sm">
							<thead>
								<tr>
									<th className="p-3">{t("cohortLabel")}</th>
									<th className="p-3">{t("devpostRegistrants")}</th>
									<th className="p-3">{t("devpostSubmitters")}</th>
								</tr>
							</thead>
							<tbody>
								{[
									[t("applications"), linkage.matchedRegistrants, linkage.matchedSubmitters],
									[t("accepted"), linkage.matchedAccepted, linkage.matchedAcceptedSubmitters],
									[t("confirmed"), linkage.matchedConfirmed, linkage.matchedConfirmedSubmitters],
									[
										t("checkedIn"),
										linkage.matchedAttended ?? "—",
										linkage.matchedAttendedSubmitters ?? "—",
									],
								]
									.filter(([, registered, submitted]) => registered !== "—" || submitted !== "—")
									.map(([label, registered, submitted]) => (
										<tr key={label} className="border-t border-gray-200">
											<th scope="row" className="p-3 font-normal">
												{label}
											</th>
											<td className="p-3 tabular-nums">{registered}</td>
											<td className="p-3 tabular-nums">{submitted}</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>
				)}
				{!linkage && <p className="mt-3">{t("unavailable")}</p>}
			</section>
			<section>
				<h2 className="font-coolvetica text-2xl">{t("projectPipeline")}</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<MetricCard
						title={t("judgingRosterProjects")}
						value={data.funnel.devpostProjects}
						description={t("judgingSourceComparison", {
							public: data.funnel.devpostPublicProjects,
							gap: data.dataQuality.devpostProjectImportGap ?? "—",
						})}
					/>
				</div>
				<p className="mt-3 font-rubik text-sm">{t("projectPipelineNote")}</p>
				<dl className="mt-4 grid gap-4 sm:grid-cols-2">
					<QualityMetric label={t("teamUpRequests")} value={devpost?.teamUpRequests ?? null} />
				</dl>
			</section>
			<details className="ui-panel p-5">
				<summary className="cursor-pointer font-rubik">{t("analysisGuide")}</summary>
				<p className="mt-3 font-rubik text-sm">{t("analysisGuideNote")}</p>
				<p className="mt-3 font-rubik text-sm">{t("analysisUnavailable")}</p>
				{linkage?.matchedAttended === undefined && (
					<p className="mt-3 font-rubik text-sm">{t("attendanceLinkageUnavailable")}</p>
				)}
				<a
					className="mt-3 inline-block font-rubik text-sm underline"
					href="https://github.com/HacktheHill/prev-hackathon-analysis/tree/main/corrected_version"
				>
					{t("correctedAnalysis")}
				</a>
			</details>
		</div>
	);
};

const MetricCard = ({ title, value, description }: { title: string; value: number | string; description: string }) => (
	<section className={`ui-panel p-4 ${styles.card ?? ""}`}>
		<h2 className="font-rubik text-lg">{title}</h2>
		<p className={styles.number}>{value}</p>
		<p className="mt-2 font-rubik text-sm text-dark-color">{description}</p>
	</section>
);

type Conversion = { from: number | null; to: number | null; dropOff: number | null; rate: number | null };

const ConversionCard = ({
	title,
	conversion,
	t,
}: {
	title: string;
	conversion: Conversion;
	t: ReturnType<typeof useTranslation>["t"];
}) => (
	<section className={`ui-panel p-4 ${styles.card ?? ""}`}>
		<h3 className="font-rubik text-lg">{title}</h3>
		<p className={styles.number}>
			{conversion.rate === null ? t("unavailable") : t("conversionRate", { rate: conversion.rate })}
		</p>
		<p className="mt-2 font-rubik text-sm text-dark-color">
			{conversion.dropOff === null
				? t("conversionUnavailable")
				: t("conversionDetail", {
						from: conversion.from,
						to: conversion.to,
						dropOff: conversion.dropOff,
					})}
		</p>
	</section>
);

const DevpostSection = ({ data, t }: { data: DashboardData; t: ReturnType<typeof useTranslation>["t"] }) => (
	<section>
		<h2 className="font-coolvetica text-2xl">{t("devpostTitle")}</h2>
		<div className="mt-4 grid gap-4 sm:grid-cols-3">
			<MetricCard
				title={t("devpostRegistrants")}
				value={data.funnel.devpostRegistrants ?? 0}
				description={t("qualifier.people")}
			/>
			<MetricCard
				title={t("devpostSubmitters")}
				value={data.funnel.devpostSubmitters ?? 0}
				description={t("qualifier.teamMembers")}
			/>
			<MetricCard
				title={t("devpostSubmittedProjects")}
				value={data.funnel.devpostSubmittedProjects ?? 0}
				description={t("qualifier.submittedProjects")}
			/>
		</div>
		<div className="mt-4 grid gap-4 sm:grid-cols-2">
			<ConversionCard
				title={t("activeToSubmitter")}
				conversion={data.conversions.devpost.activeToSubmitter}
				t={t}
			/>
		</div>
		<p className="mt-4 font-rubik text-sm">{t("projectStatuses", data.externalMetrics.devpost?.payload)}</p>
		<details className="mt-4 font-rubik text-sm">
			<summary className="cursor-pointer">{t("devpostDetails")}</summary>
			<div className="mt-3 grid gap-4 sm:grid-cols-2">
				<MetricCard
					title={t("devpostActiveRegistrants")}
					value={data.funnel.devpostActiveRegistrants ?? 0}
					description={t("devpostActiveRegistrantsDescription")}
				/>
				<ConversionCard
					title={t("registrantToActive")}
					conversion={data.conversions.devpost.registrantToActive}
					t={t}
				/>
			</div>
			<p className="mt-3">
				{t("devpostSubmittersDescription")} {t("devpostSubmittedProjectsDescription")}
			</p>
		</details>
	</section>
);

const DataQuality = ({
	quality,
	uniqueApplicationEmails,
	t,
}: {
	quality: {
		sheetRows: number | null;
		sheetLinkedRows: number | null;
		sheetUnlinkedRows: number | null;
		duplicateApplicationRows: number | null;
		devpostMatchedRegistrants: number | null;
		devpostUnmatchedRegistrants: number | null;
		devpostMatchedSubmitters: number | null;
		devpostProjectImportGap: number | null;
	};
	uniqueApplicationEmails?: number;
	t: ReturnType<typeof useTranslation>["t"];
}) => (
	<section className="ui-panel p-5">
		<h2 className="font-coolvetica text-xl">{t("dataQualityTitle")}</h2>
		<p className="mt-1 font-rubik text-sm text-dark-color">{t("dataQualityDescription")}</p>
		<dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<QualityMetric
				label={t("sheetLinkageCoverage")}
				value={
					quality.sheetLinkedRows === null || quality.sheetRows === null
						? null
						: t("coverageDetail", {
								matched: quality.sheetLinkedRows,
								total: quality.sheetRows,
								rate: quality.sheetRows
									? Math.round((quality.sheetLinkedRows / quality.sheetRows) * 1000) / 10
									: 0,
							})
				}
			/>
			<QualityMetric label={t("sheetUnlinkedRows")} value={quality.sheetUnlinkedRows} />
			{uniqueApplicationEmails !== undefined && (
				<QualityMetric label={t("uniqueApplicationEmails")} value={uniqueApplicationEmails} />
			)}
			<QualityMetric
				label={t("duplicateApplicationRows")}
				value={quality.duplicateApplicationRows}
				attention={Boolean(quality.duplicateApplicationRows)}
			/>
			<QualityMetric label={t("devpostApplicationMatches")} value={quality.devpostMatchedRegistrants} />
			<QualityMetric
				label={t("devpostUnmatchedRegistrants")}
				value={quality.devpostUnmatchedRegistrants}
				attention={Boolean(quality.devpostUnmatchedRegistrants)}
			/>
			<QualityMetric label={t("devpostMatchedSubmitters")} value={quality.devpostMatchedSubmitters} />
			<QualityMetric
				label={t("devpostProjectImportGap")}
				value={quality.devpostProjectImportGap}
				attention={Boolean(quality.devpostProjectImportGap)}
			/>
		</dl>
	</section>
);

const QualityMetric = ({
	label,
	value,
	attention = false,
}: {
	label: string;
	value: number | string | null;
	attention?: boolean;
}) => (
	<div>
		<dt className="font-rubik text-sm text-dark-color">{label}</dt>
		<dd className={`font-coolvetica text-2xl ${attention ? "text-amber-900" : "text-dark-color"}`}>
			{value ?? "—"}
		</dd>
	</div>
);

const AttendanceIntegrity = ({
	integrity,
	t,
}: {
	integrity: {
		issuedPassesWithoutCheckIn: number;
		positivePresenceWithoutCheckIn: number;
		visibleCheckInEvents: number;
	};
	t: ReturnType<typeof useTranslation>["t"];
}) => {
	const healthy =
		integrity.issuedPassesWithoutCheckIn === 0 &&
		integrity.positivePresenceWithoutCheckIn === 0 &&
		integrity.visibleCheckInEvents === 1;
	return (
		<section className="ui-panel p-5">
			<h2 className="font-coolvetica text-xl">{t("integrityTitle")}</h2>
			<p className={`mt-2 font-rubik ${healthy ? "text-green-800" : "text-red-800"}`}>
				{healthy ? t("integrityHealthy") : t("integrityAttention")}
			</p>
			<details open={!healthy} className="mt-4">
				<summary className="cursor-pointer font-rubik">{t("integrityDetails")}</summary>
				<dl className="mt-4 grid gap-3 sm:grid-cols-3">
					<IntegrityCheck
						label={t("issuedPassesWithoutCheckIn")}
						value={integrity.issuedPassesWithoutCheckIn}
						expected={0}
					/>
					<IntegrityCheck
						label={t("positivePresenceWithoutCheckIn")}
						value={integrity.positivePresenceWithoutCheckIn}
						expected={0}
					/>
					<IntegrityCheck
						label={t("visibleCheckInEvents")}
						value={integrity.visibleCheckInEvents}
						expected={1}
					/>
				</dl>
			</details>
		</section>
	);
};

const IntegrityCheck = ({ label, value, expected }: { label: string; value: number; expected: number }) => (
	<div>
		<dt className="font-rubik text-sm text-dark-color">{label}</dt>
		<dd className={`font-coolvetica text-2xl ${value === expected ? "text-green-800" : "text-red-800"}`}>
			{value}
		</dd>
	</div>
);

const OperationalChart = ({
	title,
	description,
	data,
	x,
	y,
	total,
	population,
}: {
	title: string;
	description: string;
	data: object[];
	x: string;
	y: string;
	total?: number;
	population?: string;
}) => (
	<section className="ui-panel p-4">
		<h2 className="font-coolvetica text-xl">{title}</h2>
		<p className="mt-1 font-rubik text-sm text-dark-color">{description}</p>
		{total !== undefined && (
			<p className="mt-2 font-rubik text-sm font-medium">
				{population} · n={total}
			</p>
		)}
		<CountBars
			rows={data.map(entry => ({
				label: String(readChartValue(entry, x)),
				value: Number(readChartValue(entry, y)),
			}))}
			total={total}
		/>
	</section>
);

const EventOperations = ({
	data,
	locale,
	t,
}: {
	data: DashboardData;
	locale: string;
	t: ReturnType<typeof useTranslation>["t"];
}) => {
	const events = operationalEvents(data.attendanceData, locale);
	return (
		<section className="flex flex-col gap-5">
			<h2 className="font-coolvetica text-2xl">{t("uniqueAttendance")}</h2>
			{events.some(event => event.missingSessionDate) && (
				<p className="font-rubik text-sm">{t("sessionLabelsNote")}</p>
			)}
			{["food", "workshops", "activities"].map(group => {
				const rows = events.filter(event => event.displayGroup === group);
				return rows.length ? (
					<section className="ui-panel p-5" key={group}>
						<h3 className="font-coolvetica text-xl">{t(`operationsGroup.${group}`)}</h3>
						<p className="mt-2 font-rubik text-sm">{t("eventPopulationNote")}</p>
						<div className="mt-3 overflow-x-auto">
							<table className="w-full text-left font-rubik text-sm">
								<thead>
									<tr>
										{(group === "food"
											? ["eventLabel", "history.people", "recordedUnits", "history.perPerson"]
											: ["eventLabel", "history.people"]
										).map(key => (
											<th className="p-3" key={key}>
												{t(key)}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{rows.map(event => (
										<tr key={event.eventId} className="border-t border-gray-200">
											<th scope="row" className="min-w-48 p-3 font-normal">
												{event.displayLabel}
											</th>
											<td className="p-3 tabular-nums">{event.uniqueParticipants}</td>
											{group === "food" && (
												<>
													<td className="p-3 tabular-nums">{event.recordedUnits}</td>
													<td className="p-3 tabular-nums">
														{event.uniqueParticipants
															? (event.recordedUnits / event.uniqueParticipants).toFixed(
																	2,
																)
															: "—"}
													</td>
												</>
											)}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				) : null;
			})}
		</section>
	);
};

const readChartValue = (entry: object, path: string): unknown =>
	path
		.split(".")
		.reduce<unknown>(
			(value, key) => (value && typeof value === "object" ? Reflect.get(value, key) : undefined),
			entry,
		);
