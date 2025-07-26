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
				<p className="absolute bottom-2 right-2 text-right text-white">
					{charCount}/{field.charLimit}
				</p>
			)}
		</div>
	);
};

export default TextArea;
