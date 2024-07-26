import { useState } from "react";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

const TextArea = ({
	field,
	className,
	formData,
}: {
	field: ProcessedFieldGeneric<"textarea">;
	className: string;
	formData: FormData;
}) => {
	const [charCount, setCharCount] = useState(0);

	return (
		<div className="relative w-full">
			<textarea
				id={field.name}
				name={field.name}
				className={className}
				required={field.required}
				defaultValue={formData.get(field.name)?.toString() ?? ""}
				onChange={e => {
					const { value } = e.target;
					if (field.charLimit && value.length > field.charLimit) {
						e.target.value = value.slice(0, field.charLimit);
					}
					setCharCount(value.length);
				}}
			/>
			{field.charLimit && (
				<p className="absolute bottom-2 right-2 text-right text-light-color">
					{charCount ?? 0}/{field.charLimit}
				</p>
			)}
		</div>
	);
};

export default TextArea;
