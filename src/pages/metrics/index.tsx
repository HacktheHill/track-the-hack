import { TShirtSize } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useState } from "react";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import { CohortExplorer, CountBars } from "@/components/metrics/CohortExplorer";
import { trpc, type RouterOutputs } from "@/server/api/api";
import { organizerRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

const Metrics = () => {
	const { t, i18n } = useTranslation("metrics");
	const [view, setView] = useState("overview");
	const query = trpc.metrics.getMetrics.useQuery(undefined, { refetchInterval: 30_000 });
	const { data } = query;
	const lastUpdated = query.dataUpdatedAt
		? new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(
				new Date(query.dataUpdatedAt),
			)
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
		<App className="overflow-y-auto bg-default-gradient" integrated title={t("title")}>
			<div className="mx-auto flex max-w-6xl flex-col gap-8 p-8">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<h1 className="ui-page-title">{t("title")}</h1>
						<p className="mt-2 font-rubik text-sm text-dark-color">
							{lastUpdated ? t("lastUpdated", { time: lastUpdated }) : t("notUpdated")}
						</p>
					</div>
					<button
						type="button"
						className="ui-button"
						disabled={query.isFetching}
						onClick={() => void query.refetch()}
					>
						{query.isFetching ? t("refreshing") : t("refresh")}
					</button>
				</div>
				{!data && query.isLoading && <Loading />}
				{query.isError && <Error message={t(data ? "refreshFailed" : "common:temporarily-unavailable")} />}
				<nav className="flex flex-wrap gap-2" aria-label={t("viewsLabel")}>
					{["overview", "cohorts", "operations", "quality"].map(key => (
						<button
							key={key}
							type="button"
							className={`ui-button ${view === key ? "ring-2 ring-orange-700" : ""}`}
							aria-pressed={view === key}
							onClick={() => setView(key)}
						>
							{t(`view.${key}`)}
						</button>
					))}
				</nav>
				{data && (
					<>
						<div
							hidden={view !== "overview"}
							style={view !== "overview" ? { display: "none" } : undefined}
							className="flex flex-col gap-8"
						>
							<section>
								<h2 className="font-coolvetica text-2xl">{t("funnelTitle")}</h2>
								<p className="mt-1 font-rubik text-sm text-dark-color">{t("funnelDescription")}</p>
								<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
									{funnel?.map(([key, value, descriptionKey]) => (
										<MetricCard
											key={key}
											title={t(key)}
											value={value ?? t("unavailable")}
											description={t(descriptionKey)}
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
							</section>
							<section className="ui-panel p-5">
								<h2 className="font-coolvetica text-2xl">{t("attendanceOutcomesTitle")}</h2>
								<p className="mt-1 font-rubik text-sm text-dark-color">
									{t("attendanceOutcomesDescription")}
								</p>
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
							<DataQuality quality={data.dataQuality} t={t} />
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
							<div className="grid gap-8 lg:grid-cols-2">
								<OperationalChart
									title={t("uniqueAttendance")}
									description={t("uniqueAttendanceDescription")}
									data={data.attendanceData}
									x="label"
									y="uniqueParticipants"
								/>
								<OperationalChart
									title={t("eventEngagement")}
									description={t("eventEngagementDescription")}
									data={data.engagementData.map(entry => ({
										label: t(`engagement.${entry.key}`),
										participants: entry.participants,
									}))}
									x="label"
									y="participants"
								/>
								<OperationalChart
									title={t("mealCategory")}
									description={t("mealCategoryDescription")}
									data={data.mealCategoryData}
									x="mealCategory"
									y="_count.mealCategory"
								/>
								<OperationalChart
									title={t("tShirtSize")}
									description={t("tShirtSizeDescription")}
									data={data.tShirtSizeData.map(entry => ({
										...entry,
										tShirtSize:
											entry.tShirtSize === TShirtSize.NONE
												? t("common:no-t-shirt")
												: entry.tShirtSize,
									}))}
									x="tShirtSize"
									y="_count.tShirtSize"
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
									data={data.attendanceData}
									x="label"
									y="recordedUnits"
								/>
							</details>
						</div>
						<div hidden={view !== "cohorts"}>
							{sheetSnapshot && (
								<section>
									<h2 className="font-coolvetica text-2xl">{t("demographicsTitle")}</h2>
									<p className="mt-1 font-rubik text-sm text-dark-color">
										{t("demographicsDescription")}
									</p>
									<CohortExplorer dimensions={sheetSnapshot.payload.dimensions} t={t} />
								</section>
							)}
							{!sheetSnapshot && <p>{t("unavailable")}</p>}
						</div>
					</>
				)}
			</div>
		</App>
	);
};

const MetricCard = ({ title, value, description }: { title: string; value: number | string; description: string }) => (
	<section className="ui-panel p-5">
		<h2 className="font-rubik text-lg">{title}</h2>
		<p className="font-coolvetica text-3xl">{value}</p>
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
	<section className="ui-panel p-5">
		<h3 className="font-rubik text-lg">{title}</h3>
		<p className="font-coolvetica text-3xl">
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

const DevpostSection = ({
	data,
	t,
}: {
	data: RouterOutputs["metrics"]["getMetrics"];
	t: ReturnType<typeof useTranslation>["t"];
}) => (
	<section>
		<h2 className="font-coolvetica text-2xl">{t("devpostTitle")}</h2>
		<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<MetricCard
				title={t("devpostRegistrants")}
				value={data.funnel.devpostRegistrants ?? 0}
				description={t("devpostRegistrantsDescription")}
			/>
			<MetricCard
				title={t("devpostActiveRegistrants")}
				value={data.funnel.devpostActiveRegistrants ?? 0}
				description={t("devpostActiveRegistrantsDescription")}
			/>
			<MetricCard
				title={t("devpostSubmitters")}
				value={data.funnel.devpostSubmitters ?? 0}
				description={t("devpostSubmittersDescription")}
			/>
			<MetricCard
				title={t("devpostSubmittedProjects")}
				value={data.funnel.devpostSubmittedProjects ?? 0}
				description={t("devpostSubmittedProjectsDescription")}
			/>
			<MetricCard
				title={t("devpostProjects")}
				value={data.funnel.devpostProjects}
				description={t("devpostProjectsDescription")}
			/>
		</div>
		<div className="mt-4 grid gap-4 lg:grid-cols-2">
			<ConversionCard
				title={t("registrantToActive")}
				conversion={data.conversions.devpost.registrantToActive}
				t={t}
			/>
			<ConversionCard
				title={t("activeToSubmitter")}
				conversion={data.conversions.devpost.activeToSubmitter}
				t={t}
			/>
		</div>
		<p className="mt-4 font-rubik text-sm">{t("projectStatuses", data.externalMetrics.devpost?.payload)}</p>
	</section>
);

const DataQuality = ({
	quality,
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
}: {
	title: string;
	description: string;
	data: object[];
	x: string;
	y: string;
}) => (
	<section className="ui-panel p-4">
		<h2 className="font-coolvetica text-xl">{title}</h2>
		<p className="mt-1 font-rubik text-sm text-dark-color">{description}</p>
		<CountBars
			rows={data.map(entry => ({
				label: String(readChartValue(entry, x)),
				value: Number(readChartValue(entry, y)),
			}))}
		/>
	</section>
);

const readChartValue = (entry: object, path: string): unknown =>
	path
		.split(".")
		.reduce<unknown>(
			(value, key) => (value && typeof value === "object" ? Reflect.get(value, key) : undefined),
			entry,
		);

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/metrics"),
		props: await serverSideTranslations(locale ?? "en", ["navbar", "common", "metrics"]),
	};
};

export default Metrics;
