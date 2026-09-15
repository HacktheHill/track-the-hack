import { useTranslation } from "next-i18next";
import { useState } from "react";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type RadioProps = {
	field: ProcessedFieldGeneric<"radio">;
	className: string;
	formData: FormData;
};

const Radio = ({ field, className, formData }: RadioProps) => {
	const { t } = useTranslation("apply");

	const initialValue = formData.get(field.name)?.toString() ?? "";
	const initialOtherValue = formData.get(`${field.name}-other`)?.toString() ?? "";

	const [value, setValue] = useState<string>(initialValue);
	const [showOther, setShowOther] = useState<boolean>(initialValue === "other");
	const [otherValue, setOtherValue] = useState<string>(initialOtherValue);

	return (
		<div className="flex flex-wrap gap-4" role="group" aria-labelledby={`${field.name}-label`}>
			{Object.entries(field.options).map(([k, v]: [string, string]) => (
				<div key={k} className="flex items-center gap-2">
					<input
						id={`${field.name}-${k}`}
						name={field.name}
						type="radio"
						value={k}
						className="peer sr-only"
						required={field.required}
						checked={k === value}
						onChange={e => {
							setValue(e.target.value);
							setShowOther(e.target.value === "other");
						}}
					/>
					<label htmlFor={`${field.name}-${k}`} className="ui-choice">
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
					value={otherValue}
					onChange={e => setOtherValue(e.target.value)}
				/>
			)}
		</div>
	);
};

export default Radio;
