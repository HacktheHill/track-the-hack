import { useTranslation } from "next-i18next";

const ScannerResultStatus = ({ recordedNow }: { recordedNow: boolean }) => {
	const { t } = useTranslation("qr");
	return <p role="status">{t(recordedNow ? "scan-recorded" : "scan-duplicate")}</p>;
};

export default ScannerResultStatus;
