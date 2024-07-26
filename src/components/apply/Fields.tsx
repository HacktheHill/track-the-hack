import { Trans, useTranslation } from "next-i18next";
import Link from "next/link";

import type { ProcessedField } from "../../server/lib/apply";
import Field from "./Field";
import Language from "./Language";

const Fields = ({
	fields,
	page,
	formData,
	errors,
}: {
	fields: ProcessedField[];
	page: string;
	formData: FormData;
	errors: Record<string, string[] | undefined>;
}) => {
	return fields.map(field => {
		if (page === "preferredLanguage" && field.type === "radio") {
			return (
				<>
					<Language field={field} />
					<FieldError errors={errors} field={field} />
				</>
			);
		}

		return (
			<div key={field.name} className="flex flex-col items-center gap-2 sm:flex-row">
				{field.type === "checkbox" ? (
					<>
						<FieldInput field={field} formData={formData} errors={errors} />
						<FieldLabel page={page} field={field} />
					</>
				) : (
					<>
						<FieldLabel page={page} field={field} />
						<FieldInput field={field} formData={formData} errors={errors} />
					</>
				)}
			</div>
		);
	});
};


const FieldInput = ({
	field,
	formData,
	errors,
}: Readonly<{
	field: ProcessedField;
	formData: FormData;
	errors: Record<string, string[] | undefined>;
}>) => {
	return (
		<div className={`flex flex-col gap-2 ${field.type === "checkbox" ? "" : "w-full"}`}>
			<Field field={field} formData={formData} errors={errors} />
			<FieldError errors={errors} field={field} />
		</div>
	);
};

const FieldLabel = ({
	page,
	field,
}: Readonly<{
	page: string;
	field: ProcessedField;
}>) => {
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
									className="text-dark-primary-color underline"
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

function FieldError({
	errors,
	field,
}: Readonly<{ errors: Record<string, string[] | undefined>; field: ProcessedField }>) {
	return <>{errors[field.name] && <p className="text-red-500">{errors[field.name]}</p>}</>;
}

export default Fields;
