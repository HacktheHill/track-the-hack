import type { NextPage } from "next";
import Image from "next/image";
import React from "react";
import ReactMarkdown from "react-markdown";
import App from "../../components/App";
import content from "./content.md";

type ComponentProps = {
	children: React.ReactNode;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
};

const components = {
	h1: ({ children, ...props }: ComponentProps) => (
		<h1 className="my-2 text-4xl font-bold" {...props}>
			{children}
		</h1>
	),
	h2: ({ children, ...props }: ComponentProps) => (
		<h2 className="my-2 text-3xl font-bold" {...props}>
			{children}
		</h2>
	),
	h3: ({ children, ...props }: ComponentProps) => (
		<h3 className="my-2 text-2xl font-bold" {...props}>
			{children}
		</h3>
	),
	h4: ({ children, ...props }: ComponentProps) => (
		<h4 className="my-2 text-xl font-bold" {...props}>
			{children}
		</h4>
	),
	h5: ({ children, ...props }: ComponentProps) => (
		<h5 className="my-2 text-lg font-bold" {...props}>
			{children}
		</h5>
	),
	h6: ({ children, ...props }: ComponentProps) => (
		<h6 className="my-2 text-base font-bold" {...props}>
			{children}
		</h6>
	),
	p: ({ children, ...props }: ComponentProps) => (
		<p className="my-2 text-base" {...props}>
			{children}
		</p>
	),
	a: ({ children, ...props }: ComponentProps) => (
		<a className="text-blue-900" {...props} target="_blank" rel="noreferrer">
			{children}
		</a>
	),
	ul: ({ children, ...props }: ComponentProps) => (
		<ul className="list-disc" {...props}>
			{children}
		</ul>
	),
	ol: ({ children, ...props }: ComponentProps) => (
		<ol className="list-decimal" {...props}>
			{children}
		</ol>
	),
	li: ({ children, ...props }: ComponentProps) => {
		const { checked, className, ...rest } = props as {
			checked: boolean;
			className?: "task-list-item";
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
	blockquote: ({ children, ...props }: ComponentProps) => (
		<blockquote className="border-l-4 border-gray-300 pl-4" {...props}>
			{children}
		</blockquote>
	),
	table: ({ children, ...props }: ComponentProps) => (
		<table className="table-auto border-collapse border border-gray-300" {...props}>
			{children}
		</table>
	),
	thead: ({ children, ...props }: ComponentProps) => (
		<thead className="border-collapse border border-gray-300" {...props}>
			{children}
		</thead>
	),
	tbody: ({ children, ...props }: ComponentProps) => (
		<tbody className="border-collapse border border-gray-300" {...props}>
			{children}
		</tbody>
	),
	tr: ({ children, ...props }: ComponentProps) => (
		<tr className="border-collapse border border-gray-300" {...props}>
			{children}
		</tr>
	),
	th: ({ children, ...props }: ComponentProps) => (
		<th className="border-collapse border border-gray-300" {...props}>
			{children}
		</th>
	),
	td: ({ children, ...props }: ComponentProps) => {
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
	code: ({ children, inline, ...props }: ComponentProps) => {
		const className = inline ? "rounded bg-gray-200 px-2 py-1" : "rounded bg-gray-300 p-4";
		return (
			<code className={className} {...props}>
				{children}
			</code>
		);
	},
	em: ({ children, ...props }: ComponentProps) => (
		<em className="italic" {...props}>
			{children}
		</em>
	),
	strong: ({ children, ...props }: ComponentProps) => (
		<strong className="font-bold" {...props}>
			{children}
		</strong>
	),
	del: ({ children, ...props }: ComponentProps) => (
		<del className="line-through" {...props}>
			{children}
		</del>
	),
	hr: ({ ...props }: ComponentProps) => <hr className="border-gray-300" {...props} />,
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
				className="rounded border-2 border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
				{...rest}
			/>
		);
	},
};

const Resources: NextPage = () => {
	return (
		<App className="flex h-full flex-col gap-4 overflow-y-auto bg-gradient-to-b from-background2 to-background1 py-12">
			<ReactMarkdown components={components} className="mx-auto w-full max-w-2xl px-4 sm:px-16">
				{content}
			</ReactMarkdown>
		</App>
	);
};

export default Resources;
