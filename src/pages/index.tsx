import type { GetStaticProps } from "next";
import { type NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import App from "@/components/App";

import buildingSVG from "@root/public/assets/hero/building.svg";
import hackSVG from "@root/public/assets/hero/hack.svg";
import hillSVG from "@root/public/assets/hero/hill.svg";
import leavesSVG from "@root/public/assets/hero/leaves.svg";
import theSVG from "@root/public/assets/hero/the.svg";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "index"]),
	};
};

const Home: NextPage = () => {
	const { t } = useTranslation("index");

	return (
		<App className="items-left relative flex flex-col justify-center gap-2 bg-default-gradient px-8 py-6 short:gap-8">
			<Image priority src={leavesSVG} alt="" className="absolute inset-0 top-auto w-full" />
			<h2 className="z-10 w-1/2 font-coolvetica text-lg text-dark-primary-color sm:text-4xl lg:min-w-full">
				{t("description")}
			</h2>
			<Image
				priority
				className="absolute bottom-0 left-1/4 z-10 h-fit max-h-[90%] sm:left-1/2 mobile:left-2/3"
				src={buildingSVG}
				alt=""
			/>
			<h1
				aria-label={t("common:hack-the-hill-logo-alt")}
				className="relative z-10 flex h-fit w-1/2 flex-wrap gap-4 lg:w-full"
			>
				<Image priority src={hackSVG} alt="" height={120} />
				<Image priority src={theSVG} alt="" height={120} />
				<Image priority src={hillSVG} alt="" height={140} />
			</h1>
		</App>
	);
};

export default Home;
