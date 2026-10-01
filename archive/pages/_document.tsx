import Document, { Html, Head, Main, NextScript, type DocumentContext } from "next/document";

export default class ArchiveDocument extends Document<{ archiveLocale: string }> {
	static async getInitialProps(ctx: DocumentContext) {
		const props = await Document.getInitialProps(ctx);
		return { ...props, archiveLocale: Array.isArray(ctx.query.path) && ctx.query.path[0] === "fr" ? "fr" : "en" };
	}

	render() {
		return (
			<Html lang={this.props.archiveLocale}>
				<Head />
				<body>
					<Main />
					<NextScript />
				</body>
			</Html>
		);
	}
}
