import type { ProcessedFieldGeneric } from "../../server/lib/apply";

const Input = ({
	field,
	className,
	formData,
}: {
	field: ProcessedFieldGeneric<"text" | "email" | "tel" | "date" | "url" | "file">;
	className: string;
	formData: FormData;
}) => {
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
