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
		<>
			<form onSubmit={onSubmit}>
				<label htmlFor="scannerInput" className="flex-[50%] font-rubik text-dark">
					Physical Scanner
				</label>
				<input
					name="scannerInput"
					type="text"
					autoFocus
					className="w-full rounded-[100px] border-none bg-background1 px-4 py-2 font-rubik text-dark shadow-md transition-all duration-500 hover:bg-background1/50"
					onChange={onChange}
					value={scannedCode}
				/>
			</form>
			{scannedCode && (
				<button
					onClick={() => setScannedCode("")}
					className="cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light px-8 py-2 font-rubik text-white shadow-md transition-all duration-1000 hover:bg-medium"
				>
					Clear Physical
				</button>
			)}
		</>
	);
};

export default PhysicalScanner;
