import QrScanner from "qr-scanner";
import { useEffect, useRef, memo } from "react";

type QRScannerProps = {
	onScan: (data: string) => void;
};

const QRScanner = memo(function QRScanner(props: QRScannerProps) {
	const video = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!video.current) return;
		const qrScanner = new QrScanner(
			video.current,
			(result: QrScanner.ScanResult) => {
				props.onScan(result.data);
			},
			{
				returnDetailedScanResult: true,
				highlightCodeOutline: true,
			},
		);
		void qrScanner.start();

		return () => {
			qrScanner.stop();
		};
	});
	return <video ref={video} className="aspect-square rounded-3xl object-cover" width="300" height="300" />;
});

export default QRScanner;
