import { useState } from "react";
import { useTranslation } from "next-i18next";
import { trpc } from "@/server/api/api";
import type { ScannerOperation } from "@/components/useScannerOperation";

const PresenceCounter = ({
	eventId,
	hackerId,
	eventName,
	initialValue,
	initialAtLimit,
	operation,
}: {
	eventId: string;
	hackerId: string;
	eventName: string;
	initialValue: number;
	initialAtLimit: boolean;
	operation: ScannerOperation;
}) => {
	const { t } = useTranslation("qr");
	const adjustPresence = trpc.presence.adjust.useMutation();
	const [value, setValue] = useState(initialValue);
	const [atLimit, setAtLimit] = useState(initialAtLimit);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [saving, setSaving] = useState(false);

	const change = async (amount: -1 | 1) => {
		if ((amount === -1 && value <= 0) || (amount === 1 && atLimit) || !operation.begin()) return;
		setSaving(true);
		setError("");
		setNotice("");
		try {
			const next = await adjustPresence.mutateAsync({ eventId, hackerId, amount, expectedValue: value });
			setValue(next.value);
			setAtLimit(next.atLimit);
			if (next.stale) setNotice(t("adjust-stale", { value: next.value }));
		} catch {
			setError(t("adjust-error"));
		} finally {
			setSaving(false);
			operation.end();
		}
	};

	return (
		<div aria-busy={saving}>
			<p className="mt-3 font-bold">
				{eventName}: {value}
			</p>
			{value === 0 && <p>{t("zero-count")}</p>}
			{saving && <p role="status">{t("saving")}</p>}
			{notice && <p role="status">{notice}</p>}
			{atLimit && <p className="mt-2">{t("maximum-reached")}</p>}
			<div className="mt-4 flex justify-center gap-8">
				<button
					type="button"
					aria-label={t("decrease-count")}
					disabled={value <= 0 || saving}
					className="ui-button ui-button-icon"
					onClick={() => void change(-1)}
				>
					−
				</button>
				<button
					type="button"
					aria-label={t("increase-count")}
					disabled={atLimit || saving}
					className="ui-button ui-button-icon"
					onClick={() => void change(1)}
				>
					+
				</button>
			</div>
			{error && <p role="alert">{error}</p>}
		</div>
	);
};

export default PresenceCounter;
