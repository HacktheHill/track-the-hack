import type { GetStaticProps } from "next";
import { type NextPage } from "next";
import { signIn, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";

import App from "../components/App";
import Weather from "../components/Weather";


export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "index"]),
	};
};

const Home: NextPage = () => {
	const { t } = useTranslation("index");
	const { data: sessionData } = useSession();

	return (
		<App className="relative flex flex-col items-center justify-center gap-2 bg-gradient1 px-16 py-12 sm:gap-8">
			<Weather count={25} type="snowflake" />
			<Weather count={3} type="cloud" />
			<Image priority className="z-10" src="/assets/mascot-waving.svg" alt="Mascot" width={225} height={225} />
			<p className="z-10 text-center text-2xl font-bold">{t("welcome")}</p>
			<p className="text-l z-10 max-w-xl text-center">{t("description")}</p>
			{!sessionData && (
				<button
					className="z-10 whitespace-nowrap rounded border border-dark bg-background1 py-2 px-4 font-coolvetica text-dark transition-colors hover:bg-background3"
					onClick={() => void signIn()}
				>
					{t("get-started")}
				</button>
			)}
		</App>
	);
};

export default Home;
