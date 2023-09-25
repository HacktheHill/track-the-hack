import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import MetricsDashboard from "../../components/MetricsDashboard";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "maps"]),
	};
};

const Internal = () => {
	return <MetricsDashboard />;
};

export default Internal;
