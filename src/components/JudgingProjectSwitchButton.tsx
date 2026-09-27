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
	const completionStyle = isComplete
		? isLocalOnly
			? "border-amber-300 bg-amber-50 text-amber-900"
			: "border-green-300 bg-green-50 text-green-900"
		: "border-dark-primary-color/20 bg-white text-dark-primary-color";

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={isSelected}
			aria-label={`${tableLabel}: ${projectName}. ${completionLabel}. ${statusLabel}`}
			className={`min-w-44 rounded-xl border-2 p-3 text-left ${isSelected ? "border-highlight-color bg-white" : "border-dark-primary-color/20 bg-white/60"}`}
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
			<span className="mt-1 block text-xs">{statusLabel}</span>
		</button>
	);
}
