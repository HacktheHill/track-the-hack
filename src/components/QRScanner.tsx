import QrScanner from "qr-scanner";
import { useTranslation } from "next-i18next";
import { memo, useEffect, useRef } from "react";

type QRScannerProps = {
	onScan: (data: string) => void;
	setError: (message: string) => void;
};

const QRScanner = memo(function QRScanner({ onScan, setError }: QRScannerProps) {
	const { t } = useTranslation("qr");
	const video = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!video.current) return;
		const scanner = new QrScanner(video.current, result => {
			onScan(result);
			setError("");
		});
		void scanner.start().catch(() => setError(t("camera-error")));
		return () => scanner.stop();
	}, [onScan, setError, t]);

	return <video ref={video} className="aspect-square rounded-3xl object-cover" width="300" height="300" />;
});

export default QRScanner;
