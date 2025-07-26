import type { GetStaticProps } from "next";
import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import { useRouter } from "next/router";
import App from "../components/App";

import buildingSVG from "../../public/assets/hero/building.svg";
import hackSVG from "../../public/assets/hero/hack.svg";
import hillSVG from "../../public/assets/hero/hill.svg";
import starsSVG from "../../public/assets/hero/stars.svg";
import theSVG from "../../public/assets/hero/the.svg";
import titleSVG from "../../public/assets/hero/title.svg";
import sunSVG from "../../public/assets/hero/sun.svg";
import backgroundSVG from "../../public/assets/hero/background.svg";

const Hill = hillSVG as StaticImageData;
const The = theSVG as StaticImageData;
const Hack = hackSVG as StaticImageData;
const Building = buildingSVG as StaticImageData;
const Stars = starsSVG as StaticImageData;
const Title = titleSVG as StaticImageData;
const Sun = sunSVG as StaticImageData;
const Background = backgroundSVG as StaticImageData;

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
			<Image priority src={Stars} alt="Stars" className="absolute inset-0 top-auto w-full" />

			<Image priority className="absolute bottom-0 w-[40%] self-center" src={Sun} alt="Sun" />
			<Image priority className="absolute inset-0 top-auto w-full" src={Background} alt="Background" />
			<Image className="z-20 h-fit w-full min-w-96" priority src={Title} alt="Title" />
			<h1 className="relative z-10 flex h-fit flex-wrap lg:w-full">
				{/* <Image priority src={Hack} alt="Hack" height={120} />
				<Image priority src={The} alt=" the " height={120} />
				<Image priority src={Hill} alt="Hill" height={140} /> */}
			</h1>
			<div>
				<h2 className="z-10 w-1/2 font-coolvetica text-2xl text-white sm:text-4xl lg:min-w-full">
					{t("description")}
				</h2>
				<h2 className="z-10 w-1/2 font-coolvetica text-2xl text-white sm:text-4xl lg:min-w-full">@ uOttawa</h2>
			</div>
			{!sessionData && (
				<button
					className="dark-primary-colorspace-nowrap bg-midnight-blue-color z-10 w-fit rounded-lg  border px-4 py-2 font-coolvetica text-white transition-colors hover:bg-light-tertiary-color mobile:px-8 mobile:py-4 mobile:text-4xl"
					onClick={() => void router.push("/auth/sign-up")}
				>
					{t("get-started")}
				</button>
			)}
		</App>
	);
};

export default Home;
