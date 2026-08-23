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
				className="w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
				onChange={onChange}
				value={scannedCode}
			/>
			<button
				type="submit"
				disabled={!scannedCode.trim()}
				className="rounded-lg bg-light-primary-color px-4 py-2 font-coolvetica text-light-color disabled:opacity-50"
			>
				{t("manual-submit")}
			</button>
		</form>
	);
};

export default PhysicalScanner;
