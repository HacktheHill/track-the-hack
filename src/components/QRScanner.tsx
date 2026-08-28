import QrScanner from "qr-scanner";
import { memo, useEffect, useRef } from "react";

type QRScannerProps = {
	onScan: (data: string) => void;
};

const QRScanner = memo(function QRScanner({ onScan }: QRScannerProps) {
	const video = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!video.current) return;

		const qrScanner = new QrScanner(video.current, result => onScan(result.data), {});
		void qrScanner.start();

		return () => {
			qrScanner.stop();
		};
	}, [onScan]);

	return <video ref={video} className="aspect-square rounded-3xl object-cover" width="300" height="300" />;
});

export default QRScanner;
