import { useState, useEffect } from "react";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type TextAreaProps = {
	field: ProcessedFieldGeneric<"textarea">;
	className: string;
	formData: FormData;
};

const TextArea = ({ field, className, formData }: TextAreaProps) => {
	const initialValue = formData.get(field.name)?.toString() ?? "";
	const [charCount, setCharCount] = useState(initialValue.length);
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		setCharCount(value.length);
	}, [value]);

	return (
		<div className="relative w-full">
			<textarea
				id={field.name}
				name={field.name}
				className={className}
				aria-invalid={className.includes("ui-field-error") || undefined}
				aria-describedby={className.includes("ui-field-error") ? `${field.name}-error` : undefined}
				required={field.required}
				value={value}
				onChange={e => {
					const newValue = e.target.value;
					if (!field.charLimit || newValue.length <= field.charLimit) {
						setValue(newValue);
					}
				}}
			/>
			{field.charLimit && (
				<p className="mt-1 text-right text-sm text-dark-primary-color">
					{charCount}/{field.charLimit}
				</p>
			)}
		</div>
	);
};

export default TextArea;
