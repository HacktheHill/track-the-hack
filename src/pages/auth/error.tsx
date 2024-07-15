import { useTranslation } from "next-i18next";
import Head from "../../components/Head";
import Error from "../../components/Error";
import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "auth"]),
	};
};

const ErrorPage = () => {
	const { t } = useTranslation("auth");

	return (
		<>
			<Head title={t("error")} />
			<main className="flex h-screen flex-col items-center justify-center gap-10 bg-default-gradient bg-no-repeat text-center supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
				<div className="flex flex-col items-center">
					<h1 className="font-coolvetica text-[clamp(1rem,3.5vmin,5rem)] font-normal text-dark-color">
						{t("error")}
					</h1>
					<Error message={t("error-message")} />
				</div>
			</main>
		</>
	);
};

export default ErrorPage;
