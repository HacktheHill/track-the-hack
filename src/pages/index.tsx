import type { GetStaticProps } from "next";
import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import { useRouter } from "next/router";
import App from "../components/App";
import { trpc } from "../server/api/api";
import { AcceptanceStatus, RoleName } from "@prisma/client";

import buildingSVG from "../../public/assets/hero/building.svg";
import hackSVG from "../../public/assets/hero/hack.svg";
import hillSVG from "../../public/assets/hero/hill.svg";
import starsSVG from "../../public/assets/hero/stars.svg";
import theSVG from "../../public/assets/hero/the.svg";

const Hill = hillSVG as StaticImageData;
const The = theSVG as StaticImageData;
const Hack = hackSVG as StaticImageData;
const Building = buildingSVG as StaticImageData;
const stars = starsSVG as StaticImageData;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "index"]),
	};
};

const Home: NextPage = () => {
	const { t } = useTranslation("index");
	const { t: tNavbar } = useTranslation("navbar");
	const { data: sessionData } = useSession();
	const router = useRouter();
	const { data: acceptanceStatus } = trpc.users.acceptanceStatus.useQuery(undefined, { enabled: !!sessionData });
	const hasApplied = !!sessionData?.user?.hackerId;
	const isOrganizer = sessionData?.user?.roles.includes(RoleName.ORGANIZER);

	return (
		<App className="items-left relative flex flex-col justify-center gap-2 bg-default-gradient px-8 py-6 short:gap-8">
			<Image priority src={stars} alt="Leaves" className="absolute inset-0 top-auto w-full" />
			<h2 className="z-10 w-1/2 font-coolvetica text-lg text-light-secondary-color sm:text-4xl lg:min-w-full">
				{t("description")}
			</h2>
			<Image priority src={stars} alt="Leaves" className="absolute inset-0 top-0 w-full" />
			<Image
				priority
				className="absolute bottom-0 left-1/4 z-10 h-fit max-h-[90%] sm:left-1/2 mobile:left-2/3"
				src={Building}
				alt="Building"
			/>
			<h1 className="relative z-10 flex h-fit w-1/2 flex-wrap gap-4 lg:w-full">
				<Image priority src={Hack} alt="Hack" height={120} />
				<Image priority src={The} alt=" the " height={120} />
				<Image priority src={Hill} alt="Hill" height={140} />
			</h1>
			{!sessionData ? (
				<button
					className="z-10 w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-light-secondary-color transition-colors hover:bg-light-tertiary-color mobile:px-8 mobile:py-4 mobile:text-4xl"
					onClick={() => void router.push("/auth/sign-up")}
				>
					{t("get-started")}
				</button>
			) : isOrganizer ? (
				// Organizer view (hide Apply CTA)
				<div className="z-10 flex flex-wrap gap-4">
					<button
						className="text-light-secondary-highlight w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica transition-colors hover:bg-light-tertiary-color mobile:px-6 mobile:py-3 mobile:text-2xl"
						onClick={() => void router.push("/qr")}
					>
						{t("qr")}
					</button>
					<button
						className="text-light-secondary-highlight w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica transition-colors hover:bg-light-tertiary-color mobile:px-6 mobile:py-3 mobile:text-2xl"
						onClick={() => void router.push("/hackers")}
					>
						{tNavbar("hackers")}
					</button>
				</div>
			) : acceptanceStatus === AcceptanceStatus.ACCEPTED ? (
				<div className="z-10 flex gap-4">
					<button
						className="text-light-secondary-highlight w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica transition-colors hover:bg-light-tertiary-color mobile:px-6 mobile:py-3 mobile:text-2xl"
						onClick={() => void router.push(`/hacker?id=${sessionData?.user?.hackerId ?? ""}`)}
					>
						{t("profile")}
					</button>
					<button
						className="text-light-secondary-highlight w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica transition-colors hover:bg-light-tertiary-color mobile:px-6 mobile:py-3 mobile:text-2xl"
						onClick={() => void router.push("/qr")}
					>
						{t("qr")}
					</button>
				</div>
			) : acceptanceStatus === AcceptanceStatus.WAITLISTED ? (
				<div className="z-10 flex gap-4">
					<button
						className="text-light-secondary-highlight w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica transition-colors hover:bg-light-tertiary-color mobile:px-6 mobile:py-3 mobile:text-2xl"
						onClick={() => void router.push(`/hacker?id=${sessionData?.user?.hackerId ?? ""}`)}
					>
						{t("profile")}
					</button>
					<span className="font-coolvetica text-xl text-blue-300 mobile:text-3xl">{t("waitlisted")}</span>
				</div>
			) : acceptanceStatus === AcceptanceStatus.REJECTED ? (
				<div className="z-10 flex gap-4">
					<button
						className="text-light-secondary-highlight w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica transition-colors hover:bg-light-tertiary-color mobile:px-6 mobile:py-3 mobile:text-2xl"
						onClick={() => void router.push(`/hacker?id=${sessionData?.user?.hackerId ?? ""}`)}
					>
						{t("profile")}
					</button>
					<span className="font-coolvetica text-xl text-red-200 mobile:text-3xl">{t("rejected")}</span>
				</div>
			) : hasApplied ? (
				<div className="z-10 flex items-center gap-4">
					<button
						className="text-light-secondary-highlight w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica transition-colors hover:bg-light-tertiary-color mobile:px-6 mobile:py-3 mobile:text-2xl"
						onClick={() => void router.push(`/hacker?id=${sessionData?.user?.hackerId ?? ""}`)}
					>
						{t("profile")}
					</button>
					<span className="font-coolvetica text-xl text-blue-300 mobile:text-3xl">
						{t("pending-admission")}
					</span>
				</div>
			) : (
				<button
					className="z-10 w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-light-secondary-color transition-colors hover:bg-light-tertiary-color mobile:px-8 mobile:py-4 mobile:text-4xl"
					onClick={() => void router.push("/apply")}
				>
					{t("apply")}
				</button>
			)}
		</App>
	);
};

export default Home;
