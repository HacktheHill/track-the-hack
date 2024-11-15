import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";
import React from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

import type { PluggableList } from "react-markdown/lib";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkToc from "remark-toc";

import App from "../../components/App";
import en from "./en.md";
import fr from "./fr.md";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "resources"]),
	};
};

type ComponentProps = {
	children: React.ReactNode;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
};
const components = {
	/* eslint-disable  @typescript-eslint/no-unused-vars */
	h1: ({ children, node, ...props }: ComponentProps) => (
		<h1 className="mt-8 text-4xl font-bold" {...props}>
			{React.Children.map(children, child => {
				if (typeof child === "string") {
					return child;
				}
				return React.cloneElement(child as React.ReactElement, {
					className: "",
				});
			})}
		</h1>
	),
	h2: ({ children, node, ...props }: ComponentProps) => (
		<h2 className="mt-8 text-2xl text-center font-bold" {...props}>
			{React.Children.map(children, child => {
				if (typeof child === "string") {
					return child;
				}
				return React.cloneElement(child as React.ReactElement, {
					className: "",
				});
			})}
		</h2>
	),
	h3: ({ children, node, ...props }: ComponentProps) => (
		<h3 className="mt-8 text-xl font-bold" {...props}>
			{React.Children.map(children, child => {
				if (typeof child === "string") {
					return child;
				}
				return React.cloneElement(child as React.ReactElement, {
					className: "",
				});
			})}
		</h3>
	),
	h4: ({ children, node, ...props }: ComponentProps) => (
		<h4 className="mt-8 text-lg font-bold" {...props}>
			{React.Children.map(children, child => {
				if (typeof child === "string") {
					return child;
				}
				return React.cloneElement(child as React.ReactElement, {
					className: "",
				});
			})}
		</h4>
	),
	h5: ({ children, node, ...props }: ComponentProps) => (
		<h5 className="mt-8 text-sm font-bold" {...props}>
			{React.Children.map(children, child => {
				if (typeof child === "string") {
					return child;
				}
				return React.cloneElement(child as React.ReactElement, {
					className: "",
				});
			})}
		</h5>
	),
	h6: ({ children, node, ...props }: ComponentProps) => (
		<h6 className="mt-8 text-xs font-bold" {...props}>
			{React.Children.map(children, child => {
				if (typeof child === "string") {
					return child;
				}
				return React.cloneElement(child as React.ReactElement, {
					className: "",
				});
			})}
		</h6>
	),
	p: ({ children, node, ...props }: ComponentProps) => (
		<p className="my-2 text-base" {...props}>
			{children}
		</p>
	),
	a: ({ children, node, ...props }: ComponentProps) => (
		<a className="text-highlight-color hover:underline" {...props}>
			{children}
		</a>
	),
	ul: ({ children, node, ...props }: ComponentProps) => {
		const { depth, ordered, className, ...rest } = props as {
			depth: number;
			ordered: boolean;
			className?: "contains-task-list";
		};

		return (
			<ul className="list-disc" {...rest}>
				{children}
			</ul>
		);
	},
	ol: ({ children, node, ...props }: ComponentProps) => {
		const { depth, ordered, className, ...rest } = props as {
			depth: number;
			ordered: boolean;
			className?: "contains-task-list";
		};

		return (
			<ol className="list-decimal" {...rest}>
				{children}
			</ol>
		);
	},
	li: ({ children, node, ...props }: ComponentProps) => {
		const { checked, className, ordered, ...rest } = props as {
			checked: boolean;
			className?: "task-list-item";
			ordered: boolean;
		};

		if (className === "task-list-item") {
			return (
				<li className="ml-4" {...rest}>
					<input type="checkbox" checked={checked} readOnly />
					{children}
				</li>
			);
		}
		return (
			<li className="ml-4" {...rest}>
				{children}
			</li>
		);
	},
	blockquote: ({ children, node, ...props }: ComponentProps) => (
		<blockquote className="border-l-4 border-dark-primary-color pl-4" {...props}>
			{children}
		</blockquote>
	),
	table: ({ children, node, ...props }: ComponentProps) => (
		<table className="table-auto border-collapse border border-gray-300" {...props}>
			{children}
		</table>
	),
	thead: ({ children, node, ...props }: ComponentProps) => (
		<thead className="border-collapse border border-gray-300" {...props}>
			{children}
		</thead>
	),
	tbody: ({ children, node, ...props }: ComponentProps) => (
		<tbody className="border-collapse border border-gray-300" {...props}>
			{children}
		</tbody>
	),
	tr: ({ children, node, ...props }: ComponentProps) => (
		<tr className="border-collapse border border-gray-300" {...props}>
			{children}
		</tr>
	),
	th: ({ children, node, ...props }: ComponentProps) => (
		<th className="border-collapse border border-gray-300" {...props}>
			{children}
		</th>
	),
	td: ({ children, node, ...props }: ComponentProps) => {
		const { style, isHeader } = props as {
			style: React.CSSProperties;
			isHeader: boolean;
		};

		return (
			<td
				className={`border-collapse border border-gray-300 ${isHeader ? "font-bold" : ""}`}
				style={style}
				{...props}
			>
				{children}
			</td>
		);
	},
	code: ({ children, ...props }: ComponentProps) => {
		return (
			<code className="text-medium-primary-color" {...props}>
				{children}
			</code>
		);
	},
	em: ({ children, node, ...props }: ComponentProps) => (
		<em className="italic" {...props}>
			{children}
		</em>
	),
	strong: ({ children, node, ...props }: ComponentProps) => (
		<strong className="font-bold" {...props}>
			{children}
		</strong>
	),
	del: ({ children, node, ...props }: ComponentProps) => (
		<del className="line-through" {...props}>
			{children}
		</del>
	),
	hr: ({ ...props }: ComponentProps) => <hr className="my-4 border-dark-primary-color" {...props} />,
	img: ({ ...props }) => {
		const { src, alt, width, height } = props as { src: string; alt: string; width: number; height: number };
		return <Image src={src} alt={alt} width={width} height={height} />;
	},
	input: ({ ...props }) => {
		const { type, checked, disabled, ...rest } = props as { type: string; checked: boolean; disabled: boolean };
		return (
			<input
				type={type}
				checked={checked}
				disabled={disabled}
				className="rounded-lg border-2 border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
				{...rest}
			/>
		);
	},
} as Components;

const plugins = [
	[
		remarkToc,
		{
			heading: "📖 Table of contents",
		},
	],
] as PluggableList;

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
