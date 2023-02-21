import NextHead from "next/head";

type HeadProps = {
	title?: string;
};

const Head = ({ title }: HeadProps) => {
	return (
		<NextHead>
			<title>{title ? `${title} | Track the Hack` : "Track the Hack"}</title>
			<meta
				name="description"
				content="An open source project to track the participants of the Hack the Hill hackathon."
			/>
			<link rel="shortcut icon" href="/icons/favicon.svg" type="image/svg+xml" />
			<link rel="manifest" href="/manifest.json" />
			<link rel="android-chrome" sizes="192x192" href="/icons/android-chrome-192x192.png" />
			<link rel="android-chrome" sizes="512x512" href="/icons/android-chrome-512x512.png" />
			<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
			<link rel="apple-touch-icon-57x57" sizes="57x57" href="/icons/apple-touch-icon-57x57.png" />
			<link rel="apple-touch-icon-60x60" sizes="60x60" href="/icons/apple-touch-icon-60x60.png" />
			<link rel="apple-touch-icon-72x72" sizes="72x72" href="/icons/apple-touch-icon-72x72.png" />
			<link rel="apple-touch-icon-76x76" sizes="76x76" href="/icons/apple-touch-icon-76x76.png" />
			<link rel="apple-touch-icon-114x114" sizes="114x114" href="/icons/apple-touch-icon-114x114.png" />
			<link rel="apple-touch-icon-120x120" sizes="120x120" href="/icons/apple-touch-icon-120x120.png" />
			<link rel="apple-touch-icon-144x144" sizes="144x144" href="/icons/apple-touch-icon-144x144.png" />
			<link rel="apple-touch-icon-152x152" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
			<link rel="favicon-16x" sizes="16x16" href="/icons/favicon-16x16.png" />
			<link rel="favicon-32x32" sizes="32x32" href="/icons/favicon-32x32.png" />
			<link rel="favicon-96x96" sizes="96x96" href="/icons/favicon-96x96.png" />
			<link rel="favicon-128x128" sizes="128x128" href="/icons/favicon-128x128.png" />
			<link rel="favicon-196x196" sizes="196x196" href="/icons/favicon-196x196.png" />
			<link rel="mstile-70x70" sizes="70x70" href="/icons/mstile-70x70.png" />
			<link rel="mstile-144x144" sizes="144x144" href="/icons/mstile-144x144.png" />
			<link rel="mstile-150x150" sizes="150x150" href="/icons/mstile-150x150.png" />
			<link rel="mstile-310x150" sizes="310x150" href="/icons/mstile-310x150.png" />
			<link rel="mstile-310x310" sizes="310x310" href="/icons/mstile-310x310.png" />
			<meta name="theme-color" content="#3b4779" />
		</NextHead>
	);
};

export default Head;
