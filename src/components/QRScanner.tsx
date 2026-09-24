import QrScanner from "qr-scanner";
import { useTranslation } from "next-i18next";
import { memo, useEffect, useRef } from "react";

type QRScannerProps = {
	onScan: (data: string) => void;
	onClear?: () => void;
	setError: (message: string) => void;
};

const QRScanner = memo(function QRScanner({ onScan, onClear, setError }: QRScannerProps) {
	const { t } = useTranslation("qr");
	const video = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!video.current) return;
		let absenceTimer: ReturnType<typeof setTimeout> | undefined;
		const scanner = new QrScanner(
			video.current,
			result => {
				if (absenceTimer) clearTimeout(absenceTimer);
				absenceTimer = setTimeout(() => onClear?.(), 750);
				onScan(result.data);
				setError("");
			},
			{ returnDetailedScanResult: true },
		);
		void scanner.start().catch(() => setError(t("camera-error")));
		return () => {
			if (absenceTimer) clearTimeout(absenceTimer);
			scanner.stop();
		};
	}, [onClear, onScan, setError, t]);

	return (
		<video
			ref={video}
			className="mx-auto aspect-square w-full max-w-[300px] rounded-3xl object-cover"
			width="300"
			height="300"
			playsInline
		/>
	);
});

export default QRScanner;
