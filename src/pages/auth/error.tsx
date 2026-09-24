import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";

import Error from "@/components/Error";
import Head from "@/components/Head";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "auth"]),
	};
};

const ErrorPage = () => {
	const { t } = useTranslation("auth");
	const router = useRouter();
	const [error] = [router.query.error].flat();
	const errorMessage =
		error === "AccessDenied" || error === "OAuthAccountNotLinked"
			? t(`next-auth.${error}`)
			: t("next-auth.Default");

	return (
		<>
			<Head title={t("error")} />
			<main className="ui-auth-page bg-default-gradient bg-no-repeat">
				<div className="flex flex-col items-center">
					<Image
						src="/assets/hackthehill-logo.svg"
						alt={t("common:hack-the-hill-logo-alt")}
						width={130}
						height={78}
						className="h-auto w-24"
						priority
					/>
					<h1 className="ui-page-title">{t("error")}</h1>
				</div>
				<Error message={error ? errorMessage : t("common:unknown-error")} />
			</main>
		</>
	);
};

export default ErrorPage;
