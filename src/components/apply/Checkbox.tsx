import { useState } from "react";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type CheckboxProps = {
	field: ProcessedFieldGeneric<"checkbox">;
	formData: FormData;
};

const Checkbox = ({ field, formData }: CheckboxProps) => {
	const initialChecked = formData.get(field.name) === "true";
	const [checked, setChecked] = useState(initialChecked);

	return (
		<>
			<input
				id={field.name}
				name={field.name}
				type="checkbox"
				className="after: h-4 w-4 appearance-none bg-transparent text-white after:block after:h-full after:w-full after:rounded-lg after:border after:p-0.5 after:leading-[calc(100%*1/2)] after:checked:content-check"
				required={field.required}
				checked={checked}
				onChange={e => {
					setChecked(e.target.checked);
				}}
			/>
			<input type="hidden" name={field.name} readOnly value={checked ? "true" : "false"} />
		</>
	);
};

export default Checkbox;
