import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import Link from "next/link";
import { sizeByTier, sponsorsData, SponsorTier } from "../../client/sponsors";
import App from "../../components/App";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "sponsors"]),
	};
};

const Sponsors = () => {
	const { t } = useTranslation("sponsors");

	const sponsorsByTier = (tier: SponsorTier) => sponsorsData.filter(sponsor => sponsor.tier === tier);

	return (
		<App className="flex flex-col items-center justify-around gap-8 bg-default-gradient p-8" title={t("title")}>
			<h1 className="text-center text-4xl font-bold">{t("title")}</h1>
			<p className="text-center text-xl">{t("description")}</p>
			{Object.values(SponsorTier).map(tier => {
				const sponsors = sponsorsByTier(tier);
				if (sponsors.length === 0) return null;

				return (
					<div key={tier} className="flex w-full flex-wrap items-center justify-evenly gap-4">
						{sponsors.map(sponsor => (
							<Link
								key={sponsor.id}
								className="flex flex-col items-center justify-center drop-shadow-xl transition-transform hover:scale-105"
								href={`/sponsors/${sponsor.id}`}
							>
								<Image
									src={sponsor.logo}
									alt={sponsor.name}
									width={sizeByTier[sponsor.tier]}
									height={sizeByTier[sponsor.tier]}
								/>
							</Link>
						))}
					</div>
				);
			})}
		</App>
	);
};

export default Sponsors;
