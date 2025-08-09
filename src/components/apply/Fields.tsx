import { Trans, useTranslation } from "next-i18next";
import Link from "next/link";

import type { ProcessedField } from "../../server/lib/apply";
import Field from "./Field";
import Language from "./Language";

type FieldsProps = {
	fields: ProcessedField[];
	page: string;
	formData: FormData;
	errors: Record<string, string[] | undefined>;
};

const Fields = ({ fields, page, formData, errors }: FieldsProps) => {
	return fields.map(field => {
		if (page === "preferredLanguage" && field.type === "radio") {
			return (
				<div key={field.name}>
					<Language field={field} />
					<FieldError errors={errors} field={field} />
				</div>
			);
		}

		return (
			<div
				key={field.name}
				className={`flex items-center gap-2 ${
					field.type === "checkbox" ? "flex-row-reverse" : "flex-col sm:flex-row"
				}`}
			>
				<FieldLabel page={page} field={field} />
				<FieldInput field={field} formData={formData} errors={errors} />
			</div>
		);
	});
};

type FieldInputProps = Readonly<{
	field: ProcessedField;
	formData: FormData;
	errors: Record<string, string[] | undefined>;
}>;

const FieldInput = ({ field, formData, errors }: FieldInputProps) => {
	return (
		<div className={`flex flex-col gap-2 ${field.type === "checkbox" ? "" : "w-full"}`}>
			<Field field={field} formData={formData} errors={errors} />
			<FieldError errors={errors} field={field} />
		</div>
	);
};

type FieldLabelProps = {
	page: string;
	field: ProcessedField;
};

const FieldLabel = ({ page, field }: FieldLabelProps) => {
	const { t } = useTranslation("apply");
	const hasLinks = "links" in field && field.links?.length > 0;
	return (
		<label htmlFor={field.name} className="flex-[50%] font-rubik text-dark-color">
			<Trans
				i18nKey={`${page}.${field.name}.label`}
				t={t}
				components={
					hasLinks
						? field.links.map((url: string) => (
								<Link
									href={url}
									key={url}
									className="text-white underline"
									target="_blank"
									rel="noopener noreferrer"
								/>
							))
						: []
				}
			/>
			{field.required && <span className="text-red-500">&nbsp;*</span>}
		</label>
	);
};

type FieldErrorProps = Readonly<{
	errors: Record<string, string[] | undefined>;
	field: ProcessedField;
}>;

function FieldError({ errors, field }: FieldErrorProps) {
	return <>{errors[field.name] && <p className="text-red-500">{errors[field.name]?.join(". ")}</p>}</>;
}

export default Fields;
