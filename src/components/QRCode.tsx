import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";

type QRCodeProps = {
	value: string;
	label: string;
};

// The event QR carries the plain participant id and never expires, so there is
// nothing here to refresh or re-fetch. It renders once and keeps working with
// no connection, which is the point.
const QRCode = ({ value, label }: QRCodeProps) => {
	const [dataUrl, setDataUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let active = true;
		qrcode
			.toDataURL(value, { errorCorrectionLevel: "M", margin: 2, width: 320 })
			.then(result => {
				if (active) setDataUrl(result);
			})
			.catch(() => {
				if (active) setFailed(true);
			});

		return () => {
			active = false;
		};
	}, [value]);

	if (failed) return null;
	if (!dataUrl)
		return <div className="aspect-square w-[280px] animate-pulse rounded-3xl bg-light-primary-color/40" />;

	return (
		<Image
			priority
			src={dataUrl}
			alt={label}
			className="aspect-square rounded-3xl bg-white object-contain p-2"
			width={280}
			height={280}
		/>
	);
};

export default QRCode;
