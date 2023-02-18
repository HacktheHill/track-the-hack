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
			<link rel="shortcut icon" href="/favicon.svg" type="image/svg+xml" />
		</NextHead>
	);
};

export default Head;
