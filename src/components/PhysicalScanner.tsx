import { useTranslation } from "next-i18next";
import { useState, type FormEvent } from "react";

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
		<form className="flex flex-col gap-3 rounded-3xl bg-light-quaternary-color p-5" onSubmit={onSubmit}>
			<label htmlFor="scanner-input" className="font-coolvetica text-xl text-dark-color">
				{t("manual-label")}
			</label>
			<p className="font-rubik text-sm text-dark-color">{t("manual-help")}</p>
			<input
				id="scanner-input"
				name="scannerInput"
				type="text"
				autoFocus
				required
				className="ui-field w-full"
				onChange={onChange}
				value={scannedCode}
			/>
			<button type="submit" disabled={!scannedCode.trim()} className="ui-button ui-button-primary">
				{t("manual-submit")}
			</button>
		</form>
	);
};

export default PhysicalScanner;
