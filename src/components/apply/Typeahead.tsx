import { useEffect, useState } from "react";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type TypeaheadProps = {
	field: ProcessedFieldGeneric<"typeahead">;
	className: string;
	formData: FormData;
};

const Typeahead = ({ field, className, formData }: TypeaheadProps) => {
	const [options, setOptions] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchOptions = async () => {
			try {
				const res = await fetch(field.url);
				if (!res.ok) {
					throw new Error(`Error fetching options: ${res.statusText}`);
				}
				const data = await res.text();
				setOptions(data.replace(/(^")|("$)/gm, "").split("\n"));
			} catch (err) {
				setError((err as Error).message);
			}
		};

		void fetchOptions();
	}, [field.url]);

	return (
		<>
			{error && <p className="text-red-600">{error}</p>}
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
