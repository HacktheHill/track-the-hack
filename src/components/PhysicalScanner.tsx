import { useState, type FormEvent } from "react";
import { useTranslation } from "next-i18next";

type PhysicalScannerProps = {
	onScan: (data: string) => void;
};

const PhysicalScanner = (props: PhysicalScannerProps) => {
	const { t } = useTranslation("qr");
	const [scannedCode, setScannedCode] = useState("");

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		props.onScan(scannedCode);
		setScannedCode("");
	};

	const onChange = (event: FormEvent<HTMLInputElement>) => {
		setScannedCode(event.currentTarget.value);
	};

	return (
		<form className="w-full" onSubmit={onSubmit}>
			<input
				name="scannerInput"
				aria-label={t("scan-qr")}
				type="text"
				autoFocus
				className="ui-field w-full"
				onChange={onChange}
				value={scannedCode}
			/>
		</form>
	);
};

export default PhysicalScanner;
