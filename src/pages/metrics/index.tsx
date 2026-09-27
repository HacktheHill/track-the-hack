import { TShirtSize } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
					</>
				)}
			</div>
		</App>
	);
};

const MetricCard = ({ title, value, description }: { title: string; value: number; description: string }) => (
	<section className="ui-panel p-5">
		<h2 className="font-rubik text-lg">{title}</h2>
		<p className="font-coolvetica text-3xl">{value}</p>
		<p className="mt-2 font-rubik text-sm text-dark-color">{description}</p>
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
