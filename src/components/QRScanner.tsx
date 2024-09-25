import QrScanner from "qr-scanner";
import { memo, useCallback, useEffect, useRef } from "react";
import { trpc } from "../server/api/api";

type QRScannerProps = {
	onScan: (data: string) => void;
	setError: (message: string) => void;
};

const QRScanner = memo(function QRScanner(props: QRScannerProps) {
	const video = useRef<HTMLVideoElement>(null);
	const { mutateAsync: decryptHackerId } = trpc.qr.decryptHackerId.useMutation();

	const handleScan = useCallback(
		async (data: string) => {
			try {
				const decryptedHackerId = await decryptHackerId(data);
				if (!decryptedHackerId) return;
				props.onScan(decryptedHackerId);
				props.setError("");
			} catch (error) {
				console.error(error);
				props.setError((error as Error).message);
			}
		},
		[decryptHackerId, props],
	);

	useEffect(() => {
		if (!video.current) return;

		const qrScanner = new QrScanner(video.current, result => void handleScan(result.data), {});
		void qrScanner.start();

		return () => {
			qrScanner.stop();
		};
	}, [decryptHackerId, handleScan]);

	return <video ref={video} className="aspect-square rounded-3xl object-cover" width="300" height="300" />;
});

export default QRScanner;
