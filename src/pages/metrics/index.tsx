import { TShirtSize } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import { trpc } from "@/server/api/api";
import { organizerRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

const Metrics = () => {
	const { t, i18n } = useTranslation("metrics");
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
			["confirmed", data.confirmed, "confirmedDescription"],
			["checkedIn", data.checkedIn, "checkedInDescription"],
			["walkIn", data.walkIn, "walkInDescription"],
			["presences", data.presences, "presencesDescription"],
		] as const);
	const funnel =
		data &&
		([
			["applications", data.funnel.applications, "applicationsDescription"],
			["accepted", data.funnel.accepted, "acceptedDescription"],
			["acceptanceEmails", data.funnel.acceptanceEmailsSesAccepted, "acceptanceEmailsDescription"],
			["confirmed", data.funnel.confirmed, "confirmedDescription"],
			["checkedIn", data.funnel.checkedIn, "checkedInDescription"],
			["devpostProjects", data.funnel.devpostProjects, "devpostProjectsDescription"],
		] as const);
	const sheetSnapshot = data?.externalMetrics.sheet;

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
				{query.isLoading && <Loading />}
				{query.isError && <Error message={t("common:temporarily-unavailable")} />}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{totals?.map(([key, value, descriptionKey]) => (
						<MetricCard key={key} title={t(key)} value={value} description={t(descriptionKey)} />
					))}
				</div>
				{data && (
					<>
						<section>
							<h2 className="font-coolvetica text-2xl">{t("funnelTitle")}</h2>
							<p className="mt-1 font-rubik text-sm text-dark-color">{t("funnelDescription")}</p>
							<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{funnel?.map(([key, value, descriptionKey]) => (
									<MetricCard
										key={key}
										title={t(key)}
										value={value ?? t("unavailable")}
										description={t(descriptionKey)}
									/>
								))}
							</div>
						</section>
						<AttendanceIntegrity integrity={data.attendanceIntegrity} t={t} />
						<div className="grid gap-8 lg:grid-cols-2">
							<OperationalChart
								title={t("uniqueAttendance")}
								description={t("uniqueAttendanceDescription")}
								data={data.attendanceData}
								x="label"
								y="uniqueParticipants"
							/>
							<OperationalChart
								title={t("recordedUnits")}
								description={t("recordedUnitsDescription")}
								data={data.attendanceData}
								x="label"
								y="recordedUnits"
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
						{sheetSnapshot && (
							<section>
								<h2 className="font-coolvetica text-2xl">{t("demographicsTitle")}</h2>
								<p className="mt-1 font-rubik text-sm text-dark-color">
									{t("demographicsDescription", {
										time: new Intl.DateTimeFormat(i18n.language, {
											dateStyle: "medium",
											timeStyle: "short",
										}).format(new Date(sheetSnapshot.capturedAt)),
									})}
								</p>
								<div className="mt-4 grid gap-8 lg:grid-cols-2">
									{Object.entries(sheetSnapshot.payload.dimensions).map(([key, entries]) => (
										<CohortChart key={key} title={t(`dimension.${key}`)} data={entries} t={t} />
									))}
								</div>
							</section>
						)}
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

const CohortChart = ({
	title,
	data,
	t,
}: {
	title: string;
	data: Array<{ label: string; applicants: number; accepted: number; confirmed: number; attended: number }>;
	t: ReturnType<typeof useTranslation>["t"];
}) => (
	<section className="ui-panel p-4">
		<h3 className="font-coolvetica text-xl">{title}</h3>
		<ResponsiveContainer width="100%" height={320}>
			<BarChart data={data} margin={{ bottom: 70 }}>
				<XAxis dataKey="label" stroke="black" angle={-30} textAnchor="end" interval={0} height={90} />
				<YAxis stroke="black" allowDecimals={false} />
				<Tooltip />
				<Legend />
				<Bar dataKey="applicants" name={t("applications")} fill="#9ca3af" />
				<Bar dataKey="accepted" name={t("accepted")} fill="#2563eb" />
				<Bar dataKey="confirmed" name={t("confirmed")} fill="#7c3aed" />
				<Bar dataKey="attended" name={t("checkedIn")} fill="#e67300" />
			</BarChart>
		</ResponsiveContainer>
	</section>
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
				<IntegrityCheck label={t("visibleCheckInEvents")} value={integrity.visibleCheckInEvents} expected={1} />
			</dl>
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
		<ResponsiveContainer width="100%" height={280}>
			<BarChart data={data}>
				<XAxis dataKey={x} stroke="black" />
				<YAxis stroke="black" />
				<Tooltip />
				<Bar dataKey={y} fill="#e67300" />
			</BarChart>
		</ResponsiveContainer>
	</section>
);

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/metrics"),
		props: await serverSideTranslations(locale ?? "en", ["navbar", "common", "metrics"]),
	};
};

export default Metrics;
