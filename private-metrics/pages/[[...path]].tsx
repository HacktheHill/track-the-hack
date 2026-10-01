import fs from "node:fs";
import type { GetStaticPaths, GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { archiveI18n } from "@root/archive/i18n";
import { archiveDashboardSchema, type ArchiveDashboard } from "@root/private-metrics/snapshot";
import { MetricsDashboard } from "@/components/metrics/MetricsDashboard";

export const getStaticPaths: GetStaticPaths = () => ({
	paths: [{ params: { path: [] } }, { params: { path: ["fr"] } }],
	fallback: false,
});
export const getStaticProps: GetStaticProps = async ({ params }) => {
	const file = process.env.PRIVATE_METRICS_FILE;
	if (!file) throw new Error("PRIVATE_METRICS_FILE must reference a reviewed aggregate snapshot.");
	const snapshot = archiveDashboardSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
	const locale = Array.isArray(params?.path) && params.path[0] === "fr" ? "fr" : "en";
	return { props: { snapshot, ...(await serverSideTranslations(locale, ["common", "metrics"], archiveI18n)) } };
};
export default function PrivateMetricsPage({ snapshot }: { snapshot: ArchiveDashboard }) {
	const data = {
		...snapshot.metrics,
		externalMetrics: {
			sheet: snapshot.metrics.externalMetrics.sheet
				? {
						...snapshot.metrics.externalMetrics.sheet,
						capturedAt: new Date(snapshot.metrics.externalMetrics.sheet.capturedAt),
					}
				: null,
			communications: snapshot.metrics.externalMetrics.communications
				? {
						...snapshot.metrics.externalMetrics.communications,
						capturedAt: new Date(snapshot.metrics.externalMetrics.communications.capturedAt),
					}
				: null,
			devpost: snapshot.metrics.externalMetrics.devpost
				? {
						...snapshot.metrics.externalMetrics.devpost,
						capturedAt: new Date(snapshot.metrics.externalMetrics.devpost.capturedAt),
					}
				: null,
		},
	};
	return (
		<MetricsDashboard data={data} updatedAt={Date.parse(snapshot.capturedAt)} history={snapshot.history} archived />
	);
}
