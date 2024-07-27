import type { ProcessedField } from "../../server/lib/apply";

import Checkbox from "./Checkbox";
import Input from "./Input";
import Language from "./Language";
import MultiSelect from "./MultiSelect";
import Radio from "./Radio";
import Select from "./Select";
import TextArea from "./TextArea";
import Typeahead from "./Typeahead";

const Field = ({
	field,
	formData,
	errors,
}: Readonly<{
	field: ProcessedField;
	formData: FormData;
	errors: Record<string, string[] | undefined> | undefined;
}>) => {
	const fieldError = errors?.[field.name];
	const errorClass = fieldError ? "border-red-500" : "";
	const className = `w-full rounded border-none bg-light-primary-color/75 px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50 ${errorClass}`;

	if (field.name === "preferredLanguage") {
		return <Language field={field} />;
	}

	switch (field.type) {
		case "select":
			return <Select field={field} className={className} formData={formData} />;
		case "radio":
			return <Radio field={field} className={className} formData={formData} />;
		case "multiselect":
			return <MultiSelect field={field} className={className} formData={formData} />;
		case "checkbox":
			return <Checkbox field={field} />;
		case "textarea":
			return <TextArea field={field} className={className} formData={formData} />;
		case "typeahead":
			return <Typeahead field={field} className={className} formData={formData} />;
		default:
			return <Input field={field} className={className} formData={formData} />;
	}
};

export default Field;
