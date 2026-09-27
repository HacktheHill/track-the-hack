type JudgingProjectSwitchButtonProps = {
	completionLabel: string;
	isComplete: boolean;
	isLocalOnly: boolean;
	isSelected: boolean;
	onSelect: () => void;
	projectName: string;
	statusLabel: string;
	tableLabel: string;
};

export default function JudgingProjectSwitchButton({
	completionLabel,
	isComplete,
	isLocalOnly,
	isSelected,
	onSelect,
	projectName,
	statusLabel,
	tableLabel,
}: JudgingProjectSwitchButtonProps) {
	const completionState = isComplete ? (isLocalOnly ? "local" : "synced") : "needs-attention";
	const cardStyle = isComplete
		? isLocalOnly
			? "border-amber-400 bg-amber-50"
			: "border-green-500 bg-green-50"
		: "border-orange-400 bg-orange-50";
	const completionStyle = isComplete
		? isLocalOnly
			? "border-amber-300 bg-amber-50 text-amber-900"
			: "border-green-300 bg-green-50 text-green-900"
		: "border-orange-400 bg-white text-amber-950";

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={isSelected}
			aria-label={`${tableLabel}: ${projectName}. ${completionLabel}. ${statusLabel}`}
			data-completion-state={completionState}
			className={`min-w-44 rounded-xl border-2 p-3 text-left shadow-sm ${cardStyle} ${isSelected ? "ring-2 ring-highlight-color ring-offset-2" : ""}`}
		>
			<span className="flex items-start justify-between gap-2">
				<strong>{tableLabel}</strong>
				<span
					className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold ${completionStyle}`}
				>
					<span aria-hidden="true">{isComplete ? "✓" : "○"}</span>
					{completionLabel}
				</span>
			</span>
			<span className="mt-1 block truncate text-sm">{projectName}</span>
			<span className={`mt-1 block text-xs ${isComplete ? "" : "font-bold text-amber-950"}`}>
				{statusLabel}
			</span>
		</button>
	);
}
