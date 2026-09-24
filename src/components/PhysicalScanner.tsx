import { useTranslation } from "next-i18next";
import { useState, type FormEvent } from "react";

type PhysicalScannerProps = {
	onScan: (data: string) => void;
	disabled?: boolean;
};

const PhysicalScanner = (props: PhysicalScannerProps) => {
	const { t } = useTranslation("qr");
	const [scannedCode, setScannedCode] = useState("");

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (props.disabled) return;
		props.onScan(scannedCode);
		setScannedCode("");
	};

	const onChange = (event: FormEvent<HTMLInputElement>) => {
		setScannedCode(event.currentTarget.value);
	};

	return (
		<form className="w-full" onSubmit={onSubmit}>
			<input
				id="scanner-input"
				aria-label={t("manual-placeholder")}
				disabled={props.disabled}
				name="scannerInput"
				type="text"
				required
				className="ui-field w-full"
				onChange={onChange}
				placeholder={t("manual-placeholder")}
				value={scannedCode}
			/>
		</form>
	);
};

export default PhysicalScanner;
