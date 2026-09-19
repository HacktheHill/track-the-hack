import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

import type { PluggableList } from "unified";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkToc from "remark-toc";

import App from "@/components/App";
import en from "./en.md";
import fr from "./fr.md";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "resources"]),
	};
};

const components = {
	h1: ({ children, node, ...props }) => {
		void node;
		return (
			<h1
				className="mt-8 text-4xl font-bold [&>a:hover]:no-underline [&>a]:text-inherit [&>a]:no-underline"
				{...props}
			>
				{children}
			</h1>
		);
	},
	h2: ({ children, node, ...props }) => {
		void node;
		return (
			<h2
				className="mt-8 text-center text-2xl font-bold [&>a:hover]:no-underline [&>a]:text-inherit [&>a]:no-underline"
				{...props}
			>
				{children}
			</h2>
		);
	},
	h3: ({ children, node, ...props }) => {
		void node;
		return (
			<h3
				className="mt-8 text-xl font-bold [&>a:hover]:no-underline [&>a]:text-inherit [&>a]:no-underline"
				{...props}
			>
				{children}
			</h3>
		);
	},
	h4: ({ children, node, ...props }) => {
		void node;
		return (
			<h4
				className="mt-8 text-lg font-bold [&>a:hover]:no-underline [&>a]:text-inherit [&>a]:no-underline"
				{...props}
			>
				{children}
			</h4>
		);
	},
	h5: ({ children, node, ...props }) => {
		void node;
		return (
			<h5
				className="mt-8 text-sm font-bold [&>a:hover]:no-underline [&>a]:text-inherit [&>a]:no-underline"
				{...props}
			>
				{children}
			</h5>
		);
	},
	h6: ({ children, node, ...props }) => {
		void node;
		return (
			<h6
				className="mt-8 text-xs font-bold [&>a:hover]:no-underline [&>a]:text-inherit [&>a]:no-underline"
				{...props}
			>
				{children}
			</h6>
		);
	},
	p: ({ children, node, ...props }) => {
		void node;
		return (
			<p className="my-2 text-base" {...props}>
				{children}
			</p>
		);
	},
	a: ({ children, node, ...props }) => {
		void node;
		return (
			<a className="text-highlight-color hover:underline" {...props}>
				{children}
			</a>
		);
	},
	ul: ({ children, node, className, ...props }) => {
		void node;
		return (
			<ul className={`list-disc ${className ?? ""}`} {...props}>
				{children}
			</ul>
		);
	},
	ol: ({ children, node, className, ...props }) => {
		void node;
		return (
			<ol className={`list-decimal ${className ?? ""}`} {...props}>
				{children}
			</ol>
		);
	},
	li: ({ children, node, className, ...props }) => {
		void node;
		return (
			<li className={`ml-4 ${className ?? ""}`} {...props}>
				{children}
			</li>
		);
	},
	blockquote: ({ children, node, ...props }) => {
		void node;
		return (
			<blockquote className="border-l-4 border-dark-primary-color pl-4" {...props}>
				{children}
			</blockquote>
		);
	},
	table: ({ children, node, ...props }) => {
		void node;
		return (
			<table className="table-auto border-collapse border border-gray-300" {...props}>
				{children}
			</table>
		);
	},
	thead: ({ children, node, ...props }) => {
		void node;
		return (
			<thead className="border-collapse border border-gray-300" {...props}>
				{children}
			</thead>
		);
	},
	tbody: ({ children, node, ...props }) => {
		void node;
		return (
			<tbody className="border-collapse border border-gray-300" {...props}>
				{children}
			</tbody>
		);
	},
	tr: ({ children, node, ...props }) => {
		void node;
		return (
			<tr className="border-collapse border border-gray-300" {...props}>
				{children}
			</tr>
		);
	},
	th: ({ children, node, ...props }) => {
		void node;
		return (
			<th className="border-collapse border border-gray-300" {...props}>
				{children}
			</th>
		);
	},
	td: ({ children, node, ...props }) => {
		void node;
		return (
			<td className="border-collapse border border-gray-300" {...props}>
				{children}
			</td>
		);
	},
	code: ({ children, node, ...props }) => {
		void node;
		return (
			<code className="text-medium-primary-color" {...props}>
				{children}
			</code>
		);
	},
	em: ({ children, node, ...props }) => {
		void node;
		return (
			<em className="italic" {...props}>
				{children}
			</em>
		);
	},
	strong: ({ children, node, ...props }) => {
		void node;
		return (
			<strong className="font-bold" {...props}>
				{children}
			</strong>
		);
	},
	del: ({ children, node, ...props }) => {
		void node;
		return (
			<del className="line-through" {...props}>
				{children}
			</del>
		);
	},
	hr: ({ node, ...props }) => {
		void node;
		return <hr className="my-4 border-dark-primary-color" {...props} />;
	},
	input: ({ node, ...props }) => {
		void node;
		return <input className={props.type === "checkbox" ? "ui-checkbox" : "ui-field"} {...props} />;
	},
} satisfies Components;

const plugins = [
	[
		remarkToc,
		{
			heading: "📖 Table of contents",
		},
	],
] satisfies PluggableList;

const Resources: NextPage = () => {
	const { t } = useTranslation("resources");
	const router = useRouter();
	const { locale } = router;

	return (
		<App
			className="flex h-full flex-col gap-10 overflow-y-auto bg-default-gradient py-12"
			noIndex
			title={t("title")}
		>
			<ReactMarkdown
				components={components}
				remarkPlugins={plugins}
				rehypePlugins={[
					rehypeSlug,
					[
						rehypeAutolinkHeadings,
						{
							behavior: "wrap",
						},
					],
				]}
				className="mx-auto w-full max-w-2xl px-4 sm:px-16"
			>
				{locale === "fr" ? fr : en}
			</ReactMarkdown>
		</App>
	);
};

export default Resources;
