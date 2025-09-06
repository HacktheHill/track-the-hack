import { useTranslation } from "next-i18next";
import Image from "next/image";
import qrcode from "qrcode";
import { useEffect, useState } from "react";

import { trpc } from "../server/api/api";

import Error from "./Error";

type QRCodeProps = {
	id: string;
	setError: (message: string) => void;
};

// features:
// Sync with server rotation: calculates msToNextMinute and triggers a one-shot refetch exactly at the next minute boundary, matching how the server generates timestamped tokens.
// No full reload: only refetches the encryptedId, keeping the page and camera stable.
// Works with the 60s refetchInterval: after that first aligned tick, the built-in interval keeps it updated; the guard (isFetching || data) avoids double scheduling if the query is already active.

const QRCode = ({ id, setError }: QRCodeProps) => {
	const { t } = useTranslation("qr");

	const [qrCode, setQRCode] = useState<string | null>(null);
	// live encrypted id refresh (falls back to prop id initial)
	const encryptedIdQuery = trpc.qr.encryptedId.useQuery(undefined, {
		refetchInterval: 60 * 1000,
		refetchOnWindowFocus: true,
		enabled: true,
	});

	const effectiveId = encryptedIdQuery.data ?? id;

	useEffect(() => {
		// cancelled ensures setState runs only when it is safe: can be a problem otherwise if moving to page mid-reload
		let cancelled = false;
		async function generateQRCode(currentId: string) {
			if (!currentId) return;
			try {
				const qr = await qrcode.toDataURL(currentId);
				if (!cancelled) setQRCode(qr);
			} catch (error) {
				setError(t("qr-failed"));
				console.error(error);
			}
		}
		void generateQRCode(effectiveId);
		return () => {
			cancelled = true;
		};
	}, [effectiveId, setError, t]);

	// Align first refetch to next minute without reload (if initial id prop only)
	useEffect(() => {
		if (encryptedIdQuery.isFetching || encryptedIdQuery.data) return; // trpc query handles refresh when available
		const now = Date.now();
		const msToNextMinute = 60000 - (now % 60000);
		const timeout = setTimeout(() => {
			void encryptedIdQuery.refetch();
		}, msToNextMinute);
		return () => clearTimeout(timeout);
	}, [encryptedIdQuery]);

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
