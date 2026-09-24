import { useTranslation } from "next-i18next";
import type { ScanOutcome } from "@/server/services/scanner-workflows";

const ScannerResultStatus = ({ outcome }: { outcome: ScanOutcome }) => {
	const { t } = useTranslation("qr");
	return <p role="status">{t(`scan-outcome.${outcome}`)}</p>;
};

export default ScannerResultStatus;
