import { RoleName } from "@prisma/client";
import type { GetStaticProps } from "next";
import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import { useRouter } from "next/router";
import App from "../components/App";
import Filter from "../components/Filter";

import hackSVG from "../../public/assets/hero/hack.svg";
import hillSVG from "../../public/assets/hero/hill.svg";
import theSVG from "../../public/assets/hero/the.svg";
import buildingSVG from "../../public/assets/hero/building.svg";

const Hill = hillSVG as StaticImageData;
const The = theSVG as StaticImageData;
const Hack = hackSVG as StaticImageData;
const Building = buildingSVG as StaticImageData;

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
		<App className="items-left relative flex flex-col justify-center gap-2 bg-default-gradient px-8 py-6 short:gap-8">
			<h2 className="font-coolvetica text-4xl text-dark-primary-color">{t("welcome")}</h2>
			<Image
				priority
				className="absolute bottom-0 left-1/4 z-10 h-fit max-h-[90%] sm:left-1/2 mobile:left-2/3"
				src={Building}
				alt="Building"
			/>
			<h1 className="relative flex h-fit w-1/2 flex-wrap gap-4 lg:w-full">
				<Image priority src={Hack} alt="Hack" height={120} />
				<Image priority src={The} alt=" the " height={120} />
				<Image priority src={Hill} alt="Hill" height={140} />
			</h1>
			{sessionData ? (
				<Filter method="not" value={[RoleName.HACKER]} silent>
					<button
						className="w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors hover:bg-light-tertiary-color mobile:px-8 mobile:py-4 mobile:text-4xl"
						onClick={() => void router.push("/apply")}
					>
						{t("apply")}
					</button>
				</Filter>
			) : (
				<button
					className="w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors hover:bg-light-tertiary-color mobile:px-8 mobile:py-4 mobile:text-4xl"
					onClick={() => void router.push("/auth/sign-up")}
				>
					{t("get-started")}
				</button>
			)}
		</App>
	);
};

export default Home;
