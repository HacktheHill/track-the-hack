import type { GetStaticPaths, GetStaticProps } from "next";
import Link from "next/link";

import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { i18n } from "../../../next-i18next.config";
import { sponsorsData, type SponsorData } from "../../client/sponsors";
import App from "../../components/App";

export const getStaticPaths: GetStaticPaths = () => {
	const paths = sponsorsData.flatMap(({ id }) =>
		i18n.locales.map(locale => ({
			params: { locale, sponsor: id },
		})),
	);

	return {
		paths,
		fallback: true,
	};
};

export const getStaticProps: GetStaticProps = async ({ params, locale }) => {
	const sponsor = sponsorsData.find(({ id }) => id === params?.sponsor);

	if (!sponsor) {
		return {
			notFound: true,
		};
	}

	return {
		props: {
			...sponsor,
			...(await serverSideTranslations(locale ?? "en", ["common", "navbar", "sponsors"])),
		},
	};
};

const SponsorPage = ({ id, name, tier, logo, hiringLink, websiteLink, additionalLink }: SponsorData) => {
	const { t } = useTranslation("sponsors");

	return (
		<App className="flex flex-col justify-center overflow-y-auto bg-default-gradient p-8" title={t("title")}>
			<div className="m-auto flex max-w-md flex-col items-center gap-8">
				<Image src={logo} alt={name} className="h-48" height={200} width={200} />
				<h2 className="text-2xl font-semibold">{t("tier", { tier: t(`tiers.${tier}`) })}</h2>
				<p className="text-lg">{t(`descriptions.${id}`)}</p>
				<div className="flex items-center justify-center gap-4">
					{hiringLink && (
						<Link href={hiringLink} target="_blank" rel="noopener noreferrer">
							<button className="hover:bg-light-quaternary bg-midnight-blue-color whitespace-nowrap rounded-lg border  px-4 py-2 font-coolvetica text-white transition-colors">
								{t("hiring")}
							</button>
						</Link>
					)}
					{websiteLink && (
						<Link href={websiteLink} target="_blank" rel="noopener noreferrer">
							<button className="hover:bg-light-quaternary bg-midnight-blue-color whitespace-nowrap rounded-lg border  px-4 py-2 font-coolvetica text-white transition-colors">
								{t("website")}
							</button>
						</Link>
					)}
					{additionalLink && (
						<Link href={additionalLink} target="_blank" rel="noopener noreferrer">
							<button className="hover:bg-light-quaternary bg-midnight-blue-color whitespace-nowrap rounded-lg border  px-4 py-2 font-coolvetica text-white transition-colors">
								{t("additional")}
							</button>
						</Link>
					)}
				</div>
			</div>
		</App>
	);
};

export default SponsorPage;
