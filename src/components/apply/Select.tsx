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
	const initialValue = formData.get(field.name)?.toString() ?? "";
	const initialOtherValue = formData.get(`${field.name}-other`)?.toString() ?? "";

	const [value, setValue] = useState<string>(initialValue);
	const [showOther, setShowOther] = useState<boolean>(initialValue === "other");
	const [otherValue, setOtherValue] = useState<string>(initialOtherValue);

	return (
		<>
			<select
				id={field.name}
				name={field.name}
				className={className}
				required={field.required}
				value={value}
				onChange={e => {
					const selectedValue = e.target.value;
					setValue(selectedValue);
					setShowOther(selectedValue === "other");
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
					value={otherValue}
					onChange={e => setOtherValue(e.target.value)}
				/>
			)}
		</>
	);
};

export default Select;
