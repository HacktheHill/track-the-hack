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
								? "grid w-full grid-cols-2 items-center gap-4"
								: "flex w-full flex-wrap items-center justify-evenly gap-4"
						}
					>
						{/* wrap image in link only if tier is councillor or above */}
						{sponsors.map(sponsor =>
							![SponsorTier.BACKBENCHER, SponsorTier.IN_KIND].includes(sponsor.tier) ? (
								<Link
									key={sponsor.id}
									className="flex min-w-0 flex-col items-center justify-center drop-shadow-xl transition-transform hover:scale-105"
									href={`/sponsors/${sponsor.id}`}
								>
									<Image
										src={sponsor.logo}
										alt={sponsor.name}
										width={sponsor.displayWidth}
										height={sponsor.displayHeight}
										className="h-auto max-w-full"
									/>
								</Link>
							) : (
								<Image
									key={sponsor.id}
									src={sponsor.logo}
									alt={sponsor.name}
									width={sponsor.displayWidth}
									height={sponsor.displayHeight}
									className={
										sponsor.tier === SponsorTier.IN_KIND
											? "h-auto w-[calc(50%-0.5rem)] max-w-[220px] drop-shadow-xl"
											: "h-auto max-w-full drop-shadow-xl"
									}
								/>
							),
						)}
					</div>
				);
			})}
		</App>
	);
};

export default Sponsors;
