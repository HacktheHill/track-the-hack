import { RoleName, TShirtSize } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import { trpc } from "@/server/api/api";
import { rolesRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

const Metrics = () => {
	const { t } = useTranslation("metrics");
	const query = trpc.metrics.getMetrics.useQuery();
	const { data } = query;
	const totals =
		data &&
		([
			["provisioned", data.provisioned],
			["confirmed", data.confirmed],
			["checkedIn", data.checkedIn],
			["walkIn", data.walkIn],
			["presences", data.presences],
		] as const);

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated title={t("title")}>
			<div className="mx-auto flex max-w-6xl flex-col gap-8 p-8">
				<h1 className="ui-page-title">{t("title")}</h1>
				{query.isLoading && <Loading />}
				{query.isError && <Error message={t("common:temporarily-unavailable")} />}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{totals?.map(([key, value]) => (
						<div key={key} className="ui-panel p-5">
							<p className="font-rubik text-lg">{t(key)}</p>
							<p className="font-coolvetica text-3xl">{value}</p>
						</div>
					))}
				</div>
				{data && (
					<div className="grid gap-8 lg:grid-cols-3">
						<OperationalChart title={t("attendance")} data={data.attendanceData} x="label" y="_sum.value" />
						<OperationalChart
							title={t("mealCategory")}
							data={data.mealCategoryData}
							x="mealCategory"
							y="_count.mealCategory"
						/>
						<OperationalChart
							title={t("tShirtSize")}
							data={data.tShirtSizeData.map(entry => ({
								...entry,
								tShirtSize:
									entry.tShirtSize === TShirtSize.NONE ? t("common:no-t-shirt") : entry.tShirtSize,
							}))}
							x="tShirtSize"
							y="_count.tShirtSize"
						/>
					</div>
				)}
			</div>
		</App>
	);
};

const OperationalChart = ({ title, data, x, y }: { title: string; data: object[]; x: string; y: string }) => (
	<section className="ui-panel p-4">
		<h2 className="font-coolvetica text-xl">{title}</h2>
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
		redirect: await rolesRedirect(session, "/metrics", [RoleName.ORGANIZER, RoleName.ADMIN, RoleName.PREMIER]),
		props: await serverSideTranslations(locale ?? "en", ["navbar", "common", "metrics"]),
	};
};

export default Metrics;
