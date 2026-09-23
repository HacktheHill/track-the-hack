import type { GetServerSideProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "@/components/App";

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
	props: {
		...(await serverSideTranslations(locale ?? "en", ["rsvp", "navbar", "common"])),
	},
});

const Rsvp = () => {
	const { t } = useTranslation("rsvp");

	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("title")} noIndex>
			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("title")}</h1>
				<p className="mt-4 font-rubik text-dark-color">{t("old-rsvp-link")}</p>
			</section>
		</App>
	);
};

export default Rsvp;
