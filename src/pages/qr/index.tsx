import { Role } from "@prisma/client";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { useState } from "react";
import Image from "next/image";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { hackersRedirect } from "../../utils/redirects";
import { authOptions } from "../api/auth/[...nextauth]";

import App from "../../components/App";
import Weather from "../../components/Weather";
import OnlyRole from "../../components/OnlyRole";
import QRCode from "../../components/QRCode";
import QRScanner from "../../components/QRScanner";

const QR = () => {
	const { t } = useTranslation("qr");
	const router = useRouter();
	const [error, setError] = useState(false);

	return (
		<App
			className="relative flex h-full flex-col items-center justify-center gap-16 bg-default-gradient"
			title={t("title")}
		>
			<Weather count={30} type="snowflake" />
			<div className="flex flex-col items-center gap-6">
				<OnlyRole filter={role => role === Role.ORGANIZER}>
					<QRScanner
						onScan={(data: string) => {
							void router.push(data);
						}}
					/>
					{!error && (
						<p className="z-10 max-w-xl text-center text-lg font-bold text-dark-color">{t("scan-qr")}</p>
					)}
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>
					<QRCode setError={setError} />
					{!error && (
						<p className="z-10 max-w-xl text-center text-lg font-bold text-dark-color">{t("use-qr")}</p>
					)}
				</OnlyRole>
			</div>
			{error && (
				<div className="flex h-40 items-center justify-center text-dark-color">
					<p>You need to sign in to access the QR page.</p>
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
	const props = await hackersRedirect(session, locale);

	return {
		...props,
	};
};

export default QR;
