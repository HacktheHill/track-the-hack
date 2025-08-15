import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";

import Error from "../../components/Error";
import Head from "../../components/Head";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "auth"]),
	};
};

const ErrorPage = () => {
	const { t } = useTranslation("auth");
	const router = useRouter();
	const [error] = [router.query.error].flat();

	return (
		<>
			<Head title={t("error")} />
			<main className="flex h-screen flex-col items-center justify-center gap-4 bg-default-gradient bg-no-repeat text-center supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
				<div className="flex flex-col items-center">
					<Image
						src="/assets/hackthehill-logo.svg"
						alt={t("common:hack-the-hill-logo-alt")}
						width={192}
						height={192}
						priority
					/>
					<h1 className="font-coolvetica text-[clamp(1rem,3.5vmin,5rem)] font-normal text-dark-color">
						{t("error")}
					</h1>
				</div>
				<Error message={(error && t(`next-auth.${error}`)) ?? t("common:unknown-error")} />
			</main>
		</>
	);
};

export default ErrorPage;
