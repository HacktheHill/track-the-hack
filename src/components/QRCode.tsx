import { useTranslation } from "next-i18next";
import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";

import router from "next/router";
import Error from "./Error";

type QRCodeProps = {
	id: string;
	setError: (message: string) => void;
};

const QRCode = ({ id, setError }: QRCodeProps) => {
	const { t } = useTranslation("qr");

	const [qrCode, setQRCode] = useState<string | null>(null);

	useEffect(() => {
		async function generateQRCode() {
			if (!id) return;
			try {
				const qr = await qrcode.toDataURL(id);
				setQRCode(qr);
			} catch (error) {
				setError(t("qr-failed"));
				console.error(error);
			}
		}
		void generateQRCode();

		// Refresh the QR code every minute
		const intervalId = setInterval(() => {
			void router.replace(router.asPath);
		}, 60 * 1000);

		return () => clearInterval(intervalId);
	}, [id, setError, t]);

	if (!qrCode) {
		return <Error message={t("qr-failed")} />;
	}

	return (
		<Image
			priority
			src={qrCode}
			alt="QR Code"
			className="aspect-square rounded-3xl object-cover"
			width={300}
			height={300}
		/>
	);
};

export default QRCode;
