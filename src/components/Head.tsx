import { useTranslation } from "next-i18next";
import NextHead from "next/head";

type HeadProps = {
	title?: string;
	noIndex?: boolean;
};

const Head = ({ title, noIndex }: HeadProps) => {
	const { t } = useTranslation("common");

	return (
		<NextHead>
			{/** used site to generate icons: https://favicon.io/favicon-converter/ */}
			<title>{title ? `${title} | Track the Hack` : "Track the Hack"}</title>
			<meta name="description" content={t("description")} />
			<link rel="shortcut icon" href="/icons/favicon.svg" type="image/svg+xml" />
			<link rel="icon" href="/icons/favicon.ico" />
			<link rel="manifest" href="/manifest.json" />
			<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
			<link rel="icon" sizes="32x32" href="/icons/favicon-32x32.png" />
			<link rel="icon" sizes="16x16" href="/icons/favicon-16x16.png" />
			<link rel="android-chrome" sizes="192x192" href="/icons/android-chrome-192x192.png" />
			<link rel="android-chrome" sizes="512x512" href="/icons/android-chrome-512x512.png" />
			<meta name="theme-color" content="#EA8A60" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"></meta>
			{noIndex && <meta name="robots" content="noindex" />}
		</NextHead>
	);
};

export default Head;
