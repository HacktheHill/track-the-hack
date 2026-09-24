import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import App from "@/components/App";
import ParticipantSignOut from "@/components/ParticipantSignOut";
import QRCode from "@/components/QRCode";
import { useOfflineParticipantPass } from "@/utils/participant-pass";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["profile", "navbar", "common"]),
});

// This route is a public, static shell. The only participant value it reads is
// the QR identifier saved by an authenticated /profile load in this browser.
const Pass = () => {
	const { t } = useTranslation("profile");
	const { loaded, participantId } = useOfflineParticipantPass();

	return (
		<App
			className="flex flex-col items-center gap-8 overflow-y-auto bg-default-gradient p-6"
			title={t("offline-title")}
			noIndex
		>
			<section className="flex w-full max-w-xl flex-col items-center gap-4 rounded-xl bg-light-quaternary-color p-8 shadow-lg">
				<h1 className="text-center font-coolvetica text-3xl text-dark-color">{t("offline-title")}</h1>
				{!loaded ? (
					<div className="aspect-square w-[280px] animate-pulse rounded-3xl bg-light-primary-color/40" />
				) : participantId ? (
					<>
						<QRCode value={participantId} label={t("qr-alt")} />
						<p className="text-center font-rubik text-sm text-dark-color">{t("offline-explanation")}</p>
					</>
				) : (
					<p className="text-center font-rubik text-dark-color">{t("no-offline-pass")}</p>
				)}
			</section>

			{participantId && (
				<div className="flex flex-col items-center gap-4">
					<Link href="/profile" className="ui-button ui-button-tertiary">
						{t("view-profile")}
					</Link>
					<ParticipantSignOut />
				</div>
			)}
		</App>
	);
};

export default Pass;
