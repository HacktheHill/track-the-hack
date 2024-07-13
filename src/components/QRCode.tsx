import { RoleName } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";

import Error from "./Error";

type QRCodeProps = {
	setError?: (error: boolean) => void;
	id?: string;
};

const QRCode = ({ setError, id }: QRCodeProps) => {
	const { t } = useTranslation("qr");
	const { data: sessionData } = useSession();
	const [qrCode, setQRCode] = useState<string | null>(null);

	useEffect(() => {
		async function getQRCode() {
			// Confirmation QR code for walk-ins
			if (id) {
				try {
					const qr = await qrcode.toDataURL(`${location.origin}/confirm?id=${id}`);
					setQRCode(qr);
				} catch (error) {
					console.error(error);
				}

				// QR code for hackers
			} else if ( sessionData?.user?.roles.includes(RoleName.HACKER) && sessionData?.user?.hackerId) {
				try {
					const qr = await qrcode.toDataURL(sessionData.user?.hackerId);
					setQRCode(qr);
				} catch (error) {
					console.error(error);
				}
			}
		}
		void getQRCode();
	}, [id, sessionData?.user?.hackerId, sessionData?.user?.roles]);

	if (!qrCode) {
		setError?.(true);

		if (!sessionData?.user?.hackerId) {
			return <Error message={t("no-hacker")} />;
		}

		return <Error message={t("qr-failed")} />;
	}

	setError?.(false);

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
