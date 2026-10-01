import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { MetricsDashboard } from "@/components/metrics/MetricsDashboard";
import { trpc } from "@/server/api/api";
import { organizerRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

const Metrics = () => {
	const query = trpc.metrics.getMetrics.useQuery(undefined, { refetchInterval: 30_000 });
	return (
		<MetricsDashboard
			data={query.data}
			updatedAt={query.dataUpdatedAt}
			fetching={query.isFetching}
			loading={!query.data && query.isLoading}
			failed={query.isError}
			onRefresh={() => void query.refetch()}
		/>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/metrics"),
		props: await serverSideTranslations(locale ?? "en", ["navbar", "common", "metrics"]),
	};
};

export default Metrics;
