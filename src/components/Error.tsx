import { useTranslation } from "next-i18next";
import Link from "next/link";

type ErrorProps = {
	message: string;
};

const Error = ({ message }: ErrorProps) => {
	const { t } = useTranslation("common");

	return (
		<>
			<code>
				{t("error", {
					message,
				})}
			</code>
			<Link href="mailto:development@hackthehill.com" target="_blank" rel="noreferrer">
				<button
					type="button"
					className="transform cursor-pointer whitespace-nowrap rounded-normal border-2 border-light px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-rubik text-[clamp(1rem,1vmin,5rem)] text-light shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-white/50"
				>
					{t("contact-us")}
				</button>
			</Link>
		</>
	);
};

export default Error;
