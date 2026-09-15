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
			<Link
				href="mailto:info@ctn-rtc.org"
				target="_blank"
				rel="noreferrer"
				aria-label={t("contact-us")}
				className="ui-button"
			>
				{t("contact-us")}
			</Link>
		</div>
	);
};

export default Error;
