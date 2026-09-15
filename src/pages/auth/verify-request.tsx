import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";

import Head from "../../components/Head";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "auth"]),
	};
};

const VerifyRequest = () => {
	const { t } = useTranslation("auth");

	return (
		<>
			<Head title={t("verify-request")} />
			<main className="ui-auth-page bg-default-gradient bg-no-repeat">
				<div className="flex flex-col items-center">
					<Image
						src="/assets/hackthehill-logo.svg"
						alt={t("common:hack-the-hill-logo-alt")}
						width={128}
						height={128}
						className="h-auto w-24"
						priority
					/>
					<h1 className="ui-page-title">{t("verify-request")}</h1>
				</div>
				<p className="text-lg">{t("check-email")}</p>
			</main>
		</>
	);
};

export default VerifyRequest;
