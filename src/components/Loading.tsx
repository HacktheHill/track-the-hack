import { useTranslation } from "next-i18next";

const Loading = () => {
	const { t } = useTranslation("common");

	return (
		<div className="flex flex-col items-center justify-center">
			<svg
				className="h-10 w-10 animate-spin text-dark-color"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path fill="currentColor" d="M4 12a8 8 0 018-8v1a7 7 0 00-7 7h1z"></path>
			</svg>
			{t("loading")}
		</div>
	);
};

export default Loading;
