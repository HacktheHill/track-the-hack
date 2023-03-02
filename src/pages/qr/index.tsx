import { Role } from "@prisma/client";
import type { GetStaticProps } from "next";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Image from "next/image";

import App from "../../components/App";
import Weather from "../../components/Weather";
import OnlyRole from "../../components/OnlyRole";
import QRCode from "../../components/QRCode";
import QRScanner from "../../components/QRScanner";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "qr"]),
	};
};

const QR = () => {
	const { t } = useTranslation("qr");
	const router = useRouter();
	const { data: sessionData } = useSession();

	const [id, setId] = useState<string | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		if (id) {
			void router.push(`/hackers/hacker?id=${id}`);
		}

		if (sessionData?.user == null) {
			void router.push("/");
		}
	}, [id, router, sessionData?.user]);

	return (
		<App
			className="relative flex h-full flex-col items-center justify-center gap-16 bg-gradient2"
			title={t("title")}
		>
			<Weather count={30} type="snowflake" />
			<div className="flex flex-col items-center gap-6">
				<OnlyRole roles={[Role.ORGANIZER]}>
					<QRScanner setId={setId} />
					{!error && <p className="z-10 max-w-xl text-center text-lg font-bold text-dark">{t("scan-qr")}</p>}
				</OnlyRole>
				<OnlyRole roles={[Role.HACKER]}>
					<QRCode setError={setError} />
					{!error && <p className="z-10 max-w-xl text-center text-lg font-bold text-dark">{t("use-qr")}</p>}
				</OnlyRole>
			</div>
			<div className="h-56 w-full bg-light">
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

export default QR;
