import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import type { ProcessedFieldGeneric } from "../../server/lib/apply";

type LanguageProps = {
	field: ProcessedFieldGeneric<"radio">;
};

const Language = ({ field }: LanguageProps) => {
	const router = useRouter();
	const { t } = useTranslation("apply");

	return (
		<div className="flex justify-evenly gap-4">
			{Object.entries(field.options).map(([key, value]) => (
				<div key={key} className="flex">
					<input
						type="radio"
						id={`${field.name}-${key}`}
						name={field.name}
						value={key}
						checked={router.locale === key.toLocaleLowerCase()}
						className="peer hidden"
						onChange={() => {
							void router.push(router.pathname, router.pathname, {
								locale: key.toLocaleLowerCase(),
							});
						}}
					/>
					<label
						htmlFor={`${field.name}-${key}`}
						className="cursor-pointer whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-4xl text-dark-primary-color transition-colors hover:bg-light-tertiary-color peer-checked:bg-light-primary-color/50"
					>
						{t(value)}
					</label>
				</div>
			))}
		</div>
	);
};

export default Language;
