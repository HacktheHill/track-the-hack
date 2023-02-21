import { Role } from "@prisma/client";
import type { GetStaticProps } from "next";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import App from "../../components/App";
import OnlyRole from "../../components/OnlyRole";
import QRCode from "../../components/QRCode";
import QRScanner from "../../components/QRScanner";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "qr"]),
	};
};

const QR = () => {
	const router = useRouter();
	const { t } = useTranslation("qr");
	const { data: sessionData } = useSession();

	const [id, setId] = useState<string | null>(null);
	useEffect(() => {
		if (id) {
			void router.push(`/hacker?id=${id}`);
		}

		if (sessionData?.user == null) {
			void router.push("/");
		}
	}, [id, router, sessionData?.user]);

	return (
		<App>
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<OnlyRole roles={[Role.ORGANIZER]}>
					<QRScanner setId={setId} />
					<p>{t("scan-qr")}</p>
				</OnlyRole>
				<OnlyRole roles={[Role.HACKER]}>
					<QRCode />
					<p>{t("use-qr")}</p>
				</OnlyRole>
			</div>
		</App>
	);
};

export default QR;
