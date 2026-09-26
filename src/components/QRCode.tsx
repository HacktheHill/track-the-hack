import Image from "next/image";
import { useTranslation } from "next-i18next";
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
	return <QRCodeContent key={value} value={value} label={label} />;
};

const QRCodeContent = ({ value, label }: QRCodeProps) => {
	const { t } = useTranslation("common");
	const [dataUrl, setDataUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let active = true;
		setFailed(false);
		Promise.resolve()
			.then(() => qrcode.toDataURL(value, { errorCorrectionLevel: "M", margin: 2, width: 320 }))
			.then(result => {
				if (active) setDataUrl(result);
			})
			.catch(() => {
				if (active) setFailed(true);
			});

		return () => {
			active = false;
		};
	}, [value, attempt]);

	if (failed)
		return (
			<div className="flex flex-col items-center gap-4">
				<p role="alert" className="text-center font-rubik text-dark-color">
					{t("qr-generation-failed")}
				</p>
				<button type="button" className="ui-button" onClick={() => setAttempt(previous => previous + 1)}>
					{t("retry")}
				</button>
			</div>
		);
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
