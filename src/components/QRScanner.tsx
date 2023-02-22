import QrScanner from "qr-scanner";
import { useEffect, useRef } from "react";

type QRScannerProps = {
	setId: (id: string) => void;
};

const QRScanner = ({ setId }: QRScannerProps) => {
	const video = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!video.current) return;
		const qrScanner = new QrScanner(
			video.current,
			(result: QrScanner.ScanResult) => {
				setId(result.data);
			},
			{
				returnDetailedScanResult: true,
				highlightCodeOutline: true,
			},
		);
		void qrScanner.start();
	});
	return <video ref={video} className="aspect-square rounded-3xl object-cover" width="300" height="300" />;
};

export default QRScanner;
