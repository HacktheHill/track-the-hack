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
				className="ui-checkbox"
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
