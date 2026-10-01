import Link from "next/link";

import { useTranslation } from "next-i18next";
import Image from "next/image";
import { type SponsorData } from "@/client/sponsors";
import App from "@/components/App";

const SponsorPage = ({ id, name, logo, hiringLink, websiteLink, additionalLink }: SponsorData) => {
	const { t } = useTranslation("sponsors");

	return (
		<App className="flex flex-col justify-center overflow-y-auto bg-default-gradient p-8" title={t("title")}>
			<div className="m-auto flex max-w-md flex-col items-center gap-8">
				<Image src={logo} alt={name} className="h-48 max-w-full object-contain" height={200} width={200} />
				<h1 className="text-center text-3xl font-semibold">{name}</h1>
				<p className="text-lg">{t(`descriptions.${id}`)}</p>
				<div className="flex flex-wrap items-center justify-center gap-4">
					{hiringLink && (
						<Link href={hiringLink} target="_blank" rel="noopener noreferrer" className="ui-button">
							{t("hiring")}
						</Link>
					)}
					<Link href={websiteLink} target="_blank" rel="noopener noreferrer" className="ui-button">
						{t("website")}
					</Link>
					{additionalLink && (
						<Link href={additionalLink} target="_blank" rel="noopener noreferrer" className="ui-button">
							{t("additional")}
						</Link>
					)}
				</div>
			</div>
		</App>
	);
};

export default SponsorPage;
