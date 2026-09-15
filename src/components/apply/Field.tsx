import type { ProcessedField } from "../../server/lib/apply";

import Checkbox from "./Checkbox";
import Input from "./Input";
import Language from "./Language";
import MultiSelect from "./MultiSelect";
import Radio from "./Radio";
import Select from "./Select";
import TextArea from "./TextArea";
import Typeahead from "./Typeahead";

type FieldProps = Readonly<{
	field: ProcessedField;
	formData: FormData;
	errors: Record<string, string[] | undefined> | undefined;
}>;

const Field = ({ field, formData, errors }: FieldProps) => {
	const fieldError = errors?.[field.name];
	const errorClass = fieldError ? "ui-field-error" : "";
	const className = `ui-field w-full ${errorClass}`;

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
			return <Checkbox field={field} formData={formData} />;
		case "textarea":
			return <TextArea field={field} className={className} formData={formData} />;
		case "typeahead":
			return <Typeahead field={field} className={className} formData={formData} />;
		default:
			return <Input field={field} className={className} formData={formData} />;
	}
};

export default Field;
