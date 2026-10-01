import type { GetStaticPaths, GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { i18n } from "@root/next-i18next.config";
import { sponsorsData } from "@/client/sponsors";

export { default } from "@/components/SponsorPage";

export const getStaticPaths: GetStaticPaths = () => ({
	paths: sponsorsData.flatMap(({ id }) => i18n.locales.map(locale => ({ params: { sponsor: id }, locale }))),
	fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params, locale }) => {
	const sponsor = sponsorsData.find(({ id }) => id === params?.sponsor);
	if (!sponsor) return { notFound: true };
	return {
		props: { ...sponsor, ...(await serverSideTranslations(locale ?? "en", ["common", "navbar", "sponsors"])) },
	};
};
