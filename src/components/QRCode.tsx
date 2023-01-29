import { useSession } from "next-auth/react";
import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";

const QRCode = () => {
    const { data: sessionData } = useSession();
    const [qrCode, setQRCode] = useState<string | null>(null);

    useEffect(() => {
        async function getQRCode() {
            if (sessionData) {
                if (!sessionData.user) {
                    throw new Error("No user");
                }
                try {
                    const qr = await qrcode.toDataURL(sessionData.user.id);
                    setQRCode(qr);
                } catch (error) {
                    console.error(error);
                }
            }
        }
        void getQRCode();
    }, [sessionData]);

    if (!qrCode) return null;
    return <Image src={qrCode} alt="QR Code" width={200} height={200} />;
};

export default QRCode;
