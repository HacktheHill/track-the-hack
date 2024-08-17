import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type InputProps = {
	field: ProcessedFieldGeneric<"text" | "email" | "tel" | "date" | "number" | "url" | "file">;
	className: string;
	formData: FormData;
};

const Input = ({ field, className, formData }: InputProps) => {
	return (
		<input
			id={field.name}
			name={field.name}
			type={field.type}
			className={className}
			required={field.required}
			accept={field.type === "file" ? "application/pdf" : undefined}
			defaultValue={field.type === "file" ? undefined : formData.get(field.name)?.toString() ?? ""}
		/>
	);
};

export default Input;
