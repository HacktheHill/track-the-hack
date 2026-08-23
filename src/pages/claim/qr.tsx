import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useEffect, useState } from "react";
import App from "@/components/App";
import QRCode from "@/components/QRCode";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["claim", "navbar", "common"]),
});

const ClaimQr = () => {
	const { t } = useTranslation("claim");
	const [claimUrl, setClaimUrl] = useState("");

	useEffect(() => {
		const token = window.location.hash.slice(1);
		if (token) setClaimUrl(`${window.location.origin}/claim#${token}`);
	}, []);

	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("qr-title")} noIndex>
			<section className="flex w-full max-w-xl flex-col items-center gap-4 rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("qr-title")}</h1>
				<p className="font-rubik text-dark-color">{t("qr-explanation")}</p>
				{claimUrl ? <QRCode value={claimUrl} label={t("qr-alt")} /> : <p>{t("unavailable")}</p>}
			</section>
		</App>
	);
};

export default ClaimQr;
