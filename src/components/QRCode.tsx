import { useSession } from "next-auth/react";
import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";
import { trpc } from "../utils/api";
import Error from "./Error";

type QRCodeProps = {
	setError: (error: boolean) => void;
};

const QRCode = ({ setError }: QRCodeProps) => {
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

	if (query.isError) {
		setError(true);
		return <Error message="User not registered" />;
	}

	if (!qrCode) {
		setError(true);
		return <Error message="Cannot find QR code" />;
	}
	setError(false);
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
