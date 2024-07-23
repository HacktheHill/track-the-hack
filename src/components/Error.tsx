import { useTranslation } from "next-i18next";
import Link from "next/link";

type ErrorProps = {
	message: string;
};

const Error = ({ message }: ErrorProps) => {
	const { t } = useTranslation("common");

	return (
		<div className="flex flex-col items-center justify-center gap-4">
			<code>
				{t("error-message", {
					message,
				})}
			</code>
			<Link href="mailto:development@hackthehill.com" target="_blank" rel="noreferrer">
				<button
					type="button"
					className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
				>
					{t("contact-us")}
				</button>
			</Link>
		</div>
	);
};

export default Error;
