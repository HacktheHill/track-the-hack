import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type SelectProps = {
	field: ProcessedFieldGeneric<"select">;
	className: string;
	formData: FormData;
};

const Select = ({ field, className, formData }: SelectProps) => {
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
		<>
			<select
				id={field.name}
				name={field.name}
				className={className}
				required={field.required}
				value={value ?? ""}
				onChange={e => {
					setValue(e.target.value);
					setShowOther(e.target.value === "other");
				}}
			>
				<option value="">{t("select")}</option>
				{Object.entries(field.options).map(([key, value]: [string, string]) => (
					<option key={key} value={key}>
						{t(value)}
					</option>
				))}
			</select>
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
		</>
	);
};

export default Select;
