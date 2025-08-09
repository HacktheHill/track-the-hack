import { useState, type FormEvent } from "react";

type PhysicalScannerProps = {
	onScan: (data: string) => void;
};

const PhysicalScanner = (props: PhysicalScannerProps) => {
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
		<form onSubmit={onSubmit}>
			<input
				name="scannerInput"
				type="text"
				autoFocus
				className="bg-text-white hover:bg-text-white/50 w-full rounded-[100px] border-none px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500"
				onChange={onChange}
				value={scannedCode}
			/>
		</form>
	);
};

export default PhysicalScanner;
