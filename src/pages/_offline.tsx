import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import App from "@/components/App";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "offline"]),
});

const Offline: NextPage = () => {
	const { t } = useTranslation("offline");
	return (
		<App
			className="flex h-full items-center justify-center bg-default-gradient px-6 py-12 text-center text-dark-color"
			title={t("title")}
			noIndex
		>
			<div className="flex max-w-lg flex-col items-center gap-5 rounded-3xl bg-light-color/80 p-8 shadow-lg">
				<h1 className="ui-page-title">{t("title")}</h1>
				<p className="text-lg">{t("description")}</p>
				<p>{t("public-pages")}</p>
				<Link href="/schedule" className="ui-button">
					{t("open-schedule")}
				</Link>
			</div>
		</App>
	);
};

export default Offline;
