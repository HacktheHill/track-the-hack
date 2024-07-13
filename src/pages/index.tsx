import { RoleName } from "@prisma/client";
import type { GetStaticProps } from "next";
import { type NextPage } from "next";
import { signIn, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";
import App from "../components/App";
import Filter from "../components/Filter";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "index"]),
	};
};

const Home: NextPage = () => {
	const { t } = useTranslation("index");
	const { data: sessionData } = useSession();
	const router = useRouter();

	return (
			<App className="relative flex flex-col items-center justify-center gap-2 overflow-clip bg-default-gradient px-8 py-6 sm:gap-8 short:px-16 short:py-12">
				<Image
					priority
					className="z-10"
					src="/assets/mascot-waving.svg"
					alt="Mascot"
					width={225}
					height={225}
				/>
				<p className="z-10 text-center text-lg font-bold short:text-2xl">{t("welcome")}</p>
				{sessionData ? (
					<Filter method="none" silent>
						<button
							className="z-10 whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
							onClick={() => void router.push("/apply")}
						>
							{t("apply")}
						</button>
					</Filter>
				) : (
					<button
						className="z-10 whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
						onClick={() => void signIn()}
					>
						{t("get-started")}
					</button>
				)}
			</App>
	);
};

export default Home;
