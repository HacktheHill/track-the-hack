import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";

import Error from "./Error";

type QRCodeProps = {
	id: string;
	setError: (message: string) => void;
};

const QRCode = ({ id, setError }: QRCodeProps) => {
	const { t } = useTranslation("qr");
	const { data: sessionData } = useSession();
	const userId = sessionData?.user?.id;

	const [qrCode, setQRCode] = useState<string | null>(null);
	const [cachedId, setCachedId] = useState<string>("");

	const storageKey = userId ? `tth_qr_encrypted_id_${userId}` : null;

	useEffect(() => {
		if (typeof window !== "undefined" && storageKey) {
			const saved = localStorage.getItem(storageKey);
			if (saved) setCachedId(saved);
		}
	}, [storageKey]);

	// Prefer cachedId if network is offline or if id from props is empty
	const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
	const effectiveId = isOffline ? cachedId || id : id || cachedId;

	useEffect(() => {
		if (effectiveId && typeof window !== "undefined" && storageKey) {
			localStorage.setItem(storageKey, effectiveId);
		}
	}, [effectiveId, storageKey]);

	useEffect(() => {
		async function generateQRCode() {
			if (!effectiveId) return;
			try {
				const qr = await qrcode.toDataURL(effectiveId);
				setQRCode(qr);
			} catch (error) {
				setError(t("qr-failed"));
				console.error(error);
			}
		}
		void generateQRCode();

		// Refresh the QR code every minute when online
		const intervalId = setInterval(() => {
			if (typeof navigator !== "undefined" && navigator.onLine) {
				window.location.reload();
			}
		}, 30 * 1000);

		return () => clearInterval(intervalId);
	}, [effectiveId, setError, t]);

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
