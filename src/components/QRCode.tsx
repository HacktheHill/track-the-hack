import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";
import { trpc } from "../utils/api";

import Error from "./Error";

type QRCodeProps = {
	setError?: (error: boolean) => void;
	id?: string;
};

const QRCode = ({ setError, id }: QRCodeProps) => {
	const { t } = useTranslation("qr");
	const { data: sessionData } = useSession();
	const [qrCode, setQRCode] = useState<string | null>(null);

	const query = trpc.users.getHackerId.useQuery(
		{ id: sessionData?.user?.id ?? "" },
		{ enabled: !!sessionData?.user?.id },
	);

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
			} else if (query.data) {
				try {
					const qr = await qrcode.toDataURL(query.data);
					setQRCode(qr);
				} catch (error) {
					console.error(error);
				}
			}
		}
		void getQRCode();
	}, [id, query.data]);

	if (query.isError) {
		setError?.(true);
		return <Error message="User not registered" />;
	}

	if (!qrCode) {
		setError?.(true);
		return <Error message="Cannot find QR code" />;
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
