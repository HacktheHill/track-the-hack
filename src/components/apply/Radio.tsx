import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type RadioProps = {
	field: ProcessedFieldGeneric<"radio">;
	className: string;
	formData: FormData;
};

const Radio = ({
	field,
	className,
	formData,
}: RadioProps) => {
	const { t } = useTranslation("apply");
	const [showOther, setShowOther] = useState(false);
	const [value, setValue] = useState<string | undefined>();
	const [otherValue, setOtherValue] = useState<string | undefined>();

	useEffect(() => {
		const initialValue = formData.get(field.name)?.toString() ?? "";
		setValue(initialValue);
		const otherValue = formData.get(`${field.name}-other`)?.toString();
		if (initialValue === "other" && otherValue) {
			setShowOther(true);
			setOtherValue(otherValue);
		}
	}, [field.name, formData]);

	return (
		<div className="flex gap-4">
			{Object.entries(field.options).map(([k, v]: [string, string]) => (
				<div key={k} className="flex items-center gap-2">
					<input
						id={`${field.name}-${k}`}
						name={field.name}
						type="radio"
						value={k}
						className="peer hidden"
						required={field.required}
						checked={k === value}
						onChange={e => {
							setValue(e.target.value);
							setShowOther(e.target.value === "other");
						}}
					/>
					<label
						htmlFor={`${field.name}-${k}`}
						className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color peer-checked:bg-light-primary-color/50 short:text-base"
					>
						{t(v)}
					</label>
				</div>
			))}
			{field.options.other && showOther && (
				<input
					id={`${field.name}-other`}
					name={`${field.name}-other`}
					type="text"
					className={className}
					defaultValue={otherValue}
					onChange={e => setOtherValue(e.target.value)}
				/>
			)}
		</div>
	);
};

export default Radio;
