import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

const MultiSelect = ({
	field,
	className,
	formData,
}: {
	field: ProcessedFieldGeneric<"multiselect">;
	className: string;
	formData: FormData;
}) => {
	const { t } = useTranslation("apply");
	const [showOther, setShowOther] = useState(false);
	const [values, setValues] = useState<string[]>([]);
	const [otherValue, setOtherValue] = useState<string | undefined>();

	useEffect(() => {
		const initialValues = formData.getAll(`${field.name}[]`).map(v => (v instanceof File ? "" : v.toString()));
		setValues(initialValues);
		const other = formData.get(`${field.name}[]-other`)?.toString();
		if (initialValues.includes("other") && other) {
			setShowOther(true);
			setOtherValue(other);
		}
	}, [field.name, formData]);

	return (
		<div className="flex flex-col gap-2">
			<select
				id={field.name}
				name={`${field.name}[]`}
				multiple
				className={className}
				required={field.required}
				value={values}
				onChange={e => {
					const selectedValues = Array.from(e.target.selectedOptions).map(option => option.value);
					setValues(selectedValues);
					setShowOther(selectedValues.includes("other"));
				}}
			>
				{Object.entries(field.options).map(([key, value]) => (
					<option key={key} value={key}>
						{t(value)}
					</option>
				))}
			</select>
			{field.options.other && showOther && (
				<input
					id={`${field.name}-other`}
					name={`${field.name}[]-other`}
					type="text"
					className={className}
					defaultValue={otherValue}
					onChange={e => setOtherValue(e.target.value)}
				/>
			)}
		</div>
	);
};

export default MultiSelect;
