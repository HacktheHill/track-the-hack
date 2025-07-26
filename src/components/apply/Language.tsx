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
			{Object.entries(field.options).map(([key, value]) => {
				const locale = key.toLowerCase();
				const isSelected = router.locale === locale;

				return (
					<div key={key} className="flex">
						<input
							type="radio"
							id={`${field.name}-${key}`}
							name={field.name}
							value={key}
							checked={isSelected}
							className="peer hidden"
							onChange={() => {
								void router.push(router.pathname, router.pathname, {
									locale,
								});
							}}
						/>
						<label
							htmlFor={`${field.name}-${key}`}
							className={`bg-midnight-blue-color cursor-pointer whitespace-nowrap rounded-lg border  px-4 py-2 font-coolvetica text-4xl text-white transition-colors hover:bg-light-tertiary-color ${
								isSelected ? "peer-checked:bg-text-white/50" : ""
							}`}
						>
							{t(value)}
						</label>
					</div>
				);
			})}
		</div>
	);
};

export default Language;
