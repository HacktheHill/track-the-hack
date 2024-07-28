import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type CheckboxProps = {
	field: ProcessedFieldGeneric<"checkbox">;
};

const Checkbox = ({ field }: CheckboxProps) => {
	return (
		<input
			id={field.name}
			name={`${field.name}-checkbox`}
			type="checkbox"
			className="h-4 w-4 appearance-none bg-transparent text-black after:block after:h-full after:w-full after:rounded-lg after:border after:border-dark-primary-color after:p-0.5 after:leading-[calc(100%*1/2)] after:checked:content-check"
			required={field.required}
		/>
	);
};

export default Checkbox;
