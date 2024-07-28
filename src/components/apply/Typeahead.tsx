import { useEffect, useState } from "react";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type TypeaheadProps = {
	field: ProcessedFieldGeneric<"typeahead">;
	className: string;
	formData: FormData;
};

const Typeahead = ({ field, className, formData }: TypeaheadProps) => {
	const [options, setOptions] = useState<string[]>([]);

	useEffect(() => {
		const fetchOptions = async () => {
			const res = await fetch(field.url);
			const data = await res.text();
			setOptions(data.replace(/(^")|("$)/gm, "").split("\n"));
		};

		void fetchOptions();
	}, [field.options.url, field.url]);

	return (
		<>
			<input
				id={field.name}
				name={field.name}
				list={`${field.name}-list`}
				className={className}
				required={field.required}
				defaultValue={formData.get(field.name)?.toString() ?? ""}
			/>
			<datalist id={`${field.name}-list`}>
				{options.map((option, i) => (
					<option key={i} value={option} />
				))}
			</datalist>
		</>
	);
};

export default Typeahead;
