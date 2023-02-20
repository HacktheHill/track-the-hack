import { useSession } from "next-auth/react";
import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";
import { trpc } from "../utils/api";

const QRCode = () => {
	const { data: sessionData } = useSession();
	const [qrCode, setQRCode] = useState<string | null>(null);

	const query = trpc.users.getHackerId.useQuery(
		{ id: sessionData?.user?.id ?? "" },
		{ enabled: !!sessionData?.user?.id },
	);

	useEffect(() => {
		async function getQRCode() {
			if (query.data) {
				try {
					const qr = await qrcode.toDataURL(query.data);
					setQRCode(qr);
				} catch (error) {
					console.error(error);
				}
			}
		}
		void getQRCode();
	}, [query.data]);

	if (!qrCode) return null;
	return <Image src={qrCode} alt="QR Code" width={200} height={200} />;
};

export default QRCode;
