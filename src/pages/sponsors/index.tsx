import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import Link from "next/link";
import { sponsorsData, SponsorTier } from "@/client/sponsors";
import App from "@/components/App";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "sponsors"]),
	};
};

const Sponsors = () => {
	const { t } = useTranslation("sponsors");

	const sponsorsByTier = (tier: SponsorTier) => sponsorsData.filter(sponsor => sponsor.tier === tier);

	return (
		<App
			className="flex flex-col items-center justify-around gap-8 overflow-y-auto overflow-x-hidden bg-default-gradient p-8"
			title={t("title")}
		>
			<h1 className="ui-page-title text-center">{t("title")}</h1>
			<p className="text-center text-xl">{t("description")}</p>
			{Object.values(SponsorTier).map(tier => {
				const sponsors = sponsorsByTier(tier);
				if (sponsors.length === 0) return null;

				return (
					<div
						key={tier}
						className={
							tier === SponsorTier.BACKBENCHER
								? "flex w-full flex-wrap items-center justify-center gap-4"
								: "flex w-full flex-wrap items-center justify-evenly gap-4"
						}
					>
						{sponsors.map(sponsor => (
							<Link
								key={sponsor.id}
								className={`flex min-w-0 items-center justify-center drop-shadow-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 ${
									sponsor.tier === SponsorTier.IN_KIND
										? "w-[calc(50%-0.5rem)] max-w-[220px]"
										: sponsor.tier === SponsorTier.BACKBENCHER
											? "w-[calc(50%-0.5rem)] max-w-[500px]"
											: "max-w-full"
								}`}
								href={`/sponsors/${sponsor.id}`}
							>
								<Image
									src={sponsor.logo}
									alt={sponsor.name}
									width={sponsor.displayWidth}
									height={sponsor.displayHeight}
									className={
										sponsor.tier === SponsorTier.IN_KIND || sponsor.tier === SponsorTier.BACKBENCHER
											? "h-auto w-full object-contain"
											: "h-auto max-w-full object-contain"
									}
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
