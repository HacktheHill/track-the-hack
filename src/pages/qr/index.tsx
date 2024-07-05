import { Role } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";
import { hackersRedirect } from "../../utils/redirects";
import { authOptions } from "../api/auth/[...nextauth]";

import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "../../components/App";
import Filter from "../../components/Filter";
import PhysicalScanner from "../../components/PhysicalScanner";
import QRCode from "../../components/QRCode";
import QRScanner from "../../components/QRScanner";
import Weather from "../../components/Weather";

const QR = () => {
	const { t } = useTranslation("qr");
	const router = useRouter();
	const [error, setError] = useState(false);

	const onScan = (data: string) => {
		void router.push(`/hackers/hacker?id=${data}`);
	};

	return (
		<App
			className="relative flex h-full flex-col items-center justify-center gap-16 bg-default-gradient"
			title={t("title")}
		>
			<Weather count={30} type="snowflake" />
			<div className="flex flex-col items-center gap-6">
				<Filter filter={role => role === Role.ORGANIZER}>
					<>
						<QRScanner onScan={onScan} />
						<PhysicalScanner onScan={onScan} />
						{!error && (
							<p className="z-10 max-w-xl text-center text-lg font-bold text-dark-color">
								{t("scan-qr")}
							</p>
						)}
					</>
					<>
						<QRCode setError={setError} />
						{!error && (
							<p className="z-10 max-w-xl text-center text-lg font-bold text-dark-color">{t("use-qr")}</p>
						)}
					</>
				</Filter>
			</div>
			{error && (
				<div className="flex h-40 items-center justify-center text-dark-color">
					<p>{t("sign-in-to-access")}</p>
				</div>
			)}
			<div className="h-56 w-full bg-light-primary-color">
				<Image
					priority
					className="z-10 -my-4 mx-auto"
					src="/assets/beaver-hot-choco.svg"
					alt={t("mascot-choco-alt")}
					width={310}
					height={300}
				/>
			</div>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, authOptions);

	return {
		props: {
			...(await hackersRedirect(session)),
			...(await serverSideTranslations(locale ?? "en", ["qr", "navbar", "common"])),
		},
	};
};

export default QR;
