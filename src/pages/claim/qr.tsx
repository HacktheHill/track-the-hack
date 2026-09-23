import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "@/components/App";
import QRCode from "@/components/QRCode";
import { useClaimQrDisplay } from "@/hooks/useClaimQrDisplay";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["claim", "navbar", "common"]),
});

const ClaimQr = () => {
	const { t } = useTranslation("claim");
	const { claimUrl, secondsRemaining } = useClaimQrDisplay();
	const expired = secondsRemaining === 0;
	const timeRemaining =
		secondsRemaining === null
			? ""
			: `${String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:${String(secondsRemaining % 60).padStart(2, "0")}`;

	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("qr-title")} noIndex>
			<section className="flex w-full max-w-xl flex-col items-center gap-4 rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("qr-title")}</h1>
				<p className="font-rubik text-dark-color">{t("qr-explanation")}</p>
				{claimUrl && !expired ? (
					<>
						<QRCode key={claimUrl} value={claimUrl} label={t("qr-alt")} />
						{secondsRemaining !== null && <p>{t("qr-expires-in", { time: timeRemaining })}</p>}
					</>
				) : (
					<p>{expired ? t("qr-expired") : t("unavailable")}</p>
				)}
			</section>
		</App>
	);
};

export default ClaimQr;
