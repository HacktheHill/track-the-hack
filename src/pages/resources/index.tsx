import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useRef } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { sponsorsData, SponsorTier } from "@/client/sponsors";
import App from "@/components/App";
import en from "./en.md";
import fr from "./fr.md";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "resources", "sponsors"]),
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
			<p className="my-3 text-base leading-7" {...props}>
				{children}
			</p>
		);
	},
	a: ({ children, node, ...props }) => {
		void node;
		return (
			<a className="font-medium text-highlight-color underline decoration-2 underline-offset-2" {...props}>
				{children}
			</a>
		);
	},
	ul: ({ children, node, className, ...props }) => {
		void node;
		return (
			<ul className={`my-3 list-disc space-y-1 ${className ?? ""}`} {...props}>
				{children}
			</ul>
		);
	},
	ol: ({ children, node, className, ...props }) => {
		void node;
		return (
			<ol className={`my-3 list-decimal space-y-2 ${className ?? ""}`} {...props}>
				{children}
			</ol>
		);
	},
	li: ({ children, node, className, ...props }) => {
		void node;
		return (
			<li className={`ml-5 pl-1 leading-7 ${className ?? ""}`} {...props}>
				{children}
			</li>
		);
	},
	blockquote: ({ children, node, ...props }) => {
		void node;
		return (
			<blockquote
				className="my-5 rounded-r-xl border-l-4 border-dark-primary-color bg-white/40 px-5 py-3"
				{...props}
			>
				{children}
			</blockquote>
		);
	},
	table: ({ children, node, ...props }) => {
		void node;
		return (
			<div className="my-5 overflow-x-auto rounded-xl border border-dark-primary-color/30">
				<table className="w-full min-w-[34rem] table-auto border-collapse text-left" {...props}>
					{children}
				</table>
			</div>
		);
	},
	thead: ({ children, node, ...props }) => {
		void node;
		return (
			<thead className="bg-dark-primary-color/10" {...props}>
				{children}
			</thead>
		);
	},
	tbody: ({ children, node, ...props }) => {
		void node;
		return (
			<tbody className="divide-y divide-dark-primary-color/20" {...props}>
				{children}
			</tbody>
		);
	},
	tr: ({ children, node, ...props }) => {
		void node;
		return (
			<tr className="even:bg-white/25" {...props}>
				{children}
			</tr>
		);
	},
	th: ({ children, node, ...props }) => {
		void node;
		return (
			<th className="border-r border-dark-primary-color/20 px-4 py-3 last:border-r-0" {...props}>
				{children}
			</th>
		);
	},
	td: ({ children, node, ...props }) => {
		void node;
		return (
			<td className="border-r border-dark-primary-color/20 px-4 py-3 align-top last:border-r-0" {...props}>
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

type GuideSection = {
	id: string;
	title: string;
	content: string;
};

type ParsedGuide = {
	title: string;
	introduction: string;
	sections: GuideSection[];
};

const slugify = (value: string) =>
	value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");

const parseGuide = (source: string): ParsedGuide => {
	const headings = [...source.matchAll(/^# (.+)$/gm)];
	const firstHeading = headings[0];

	if (!firstHeading || firstHeading.index === undefined) {
		return { title: "Resources", introduction: source, sections: [] };
	}

	const title = firstHeading[1]?.trim() ?? "Resources";
	const introductionStart = firstHeading.index + firstHeading[0].length;
	const introductionEnd = headings[1]?.index ?? source.length;
	const introduction = source
		.slice(introductionStart, introductionEnd)
		.replace(/\n---\s*$/, "")
		.trim();
	const sections = headings.slice(1).map((heading, index) => {
		const headingIndex = heading.index ?? 0;
		const contentStart = headingIndex + heading[0].length;
		const contentEnd = headings[index + 2]?.index ?? source.length;
		const sectionTitle = heading[1]?.trim() ?? "Section";

		return {
			id: slugify(sectionTitle),
			title: sectionTitle,
			content: source
				.slice(contentStart, contentEnd)
				.replace(/\n---\s*$/, "")
				.trim(),
		};
	});

	return { title, introduction, sections };
};

const Markdown = ({ children }: { children: string }) => (
	<ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
		{children}
	</ReactMarkdown>
);

const Resources: NextPage = () => {
	const { t } = useTranslation("resources");
	const { t: sponsorsT } = useTranslation("sponsors");
	const router = useRouter();
	const { locale } = router;
	const guide = parseGuide(locale === "fr" ? fr : en);
	const guideRef = useRef<HTMLDivElement>(null);
	const sponsorsByTier = (tier: SponsorTier) => sponsorsData.filter(sponsor => sponsor.tier === tier);
	const setAllSectionsOpen = (open: boolean) => {
		guideRef.current?.querySelectorAll("details").forEach(section => {
			section.open = open;
		});
	};

	return (
		<App
			className="flex h-full flex-col gap-10 overflow-y-auto bg-default-gradient py-12"
			noIndex
			title={t("title")}
		>
			<article className="mx-auto w-full max-w-5xl px-4 sm:px-8">
				<header className="mx-auto mb-8 max-w-3xl text-center">
					<h1 className="ui-page-title mb-5">{guide.title}</h1>
					<div className="text-lg leading-8">
						<Markdown>{guide.introduction}</Markdown>
					</div>
				</header>

				{guide.sections.length > 0 ? (
					<>
						<div className="mb-4 flex flex-wrap justify-end gap-2" aria-label="Guide section controls">
							<button className="ui-button" type="button" onClick={() => setAllSectionsOpen(true)}>
								{locale === "fr" ? "Tout développer" : "Expand all"}
							</button>
							<button className="ui-button" type="button" onClick={() => setAllSectionsOpen(false)}>
								{locale === "fr" ? "Tout réduire" : "Collapse all"}
							</button>
						</div>
						<div ref={guideRef} className="space-y-4">
							{guide.sections.map((section, index) => (
								<details
									key={section.id}
									id={section.id}
									open={index === 0}
									className="group scroll-mt-24 overflow-hidden rounded-2xl border border-dark-primary-color/40 bg-white/35 shadow-sm open:bg-white/50"
								>
									<summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-coolvetica text-xl font-bold text-dark-color transition-colors marker:hidden hover:bg-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-highlight-color sm:px-6 [&::-webkit-details-marker]:hidden">
										<span>{section.title}</span>
										<span
											aria-hidden="true"
											className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dark-primary-color text-2xl leading-none transition-transform group-open:rotate-45"
										>
											+
										</span>
									</summary>
									<div className="border-t border-dark-primary-color/20 px-5 pb-6 pt-2 sm:px-6">
										<Markdown>{section.content}</Markdown>
									</div>
								</details>
							))}
						</div>
					</>
				) : null}
			</article>
			<section
				id="sponsors"
				aria-labelledby="sponsors-title"
				className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4 sm:px-8"
			>
				<h2 id="sponsors-title" className="ui-page-title text-center">
					{sponsorsT("title")}
				</h2>
				<p className="text-center text-xl">{sponsorsT("description")}</p>
				{Object.values(SponsorTier).map(tier => {
					const sponsors = sponsorsByTier(tier);
					if (sponsors.length === 0) return null;

					return (
						<div
							key={tier}
							className={
								tier === SponsorTier.BACKBENCHER
									? "flex w-full flex-wrap items-center justify-center gap-4"
									: "flex w-full flex-wrap items-center justify-evenly gap-4"
							}
						>
							{sponsors.map(sponsor => (
								<Link
									key={sponsor.id}
									aria-label={sponsor.name}
									className={`flex min-w-0 items-center justify-center drop-shadow-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 ${
										sponsor.tier === SponsorTier.IN_KIND
											? "w-[calc(50%-0.5rem)] max-w-[220px]"
											: sponsor.tier === SponsorTier.BACKBENCHER
												? "w-[calc(50%-0.5rem)] max-w-[500px]"
												: "max-w-full"
									}`}
									href={`/sponsors/${sponsor.id}`}
								>
									<Image
										src={sponsor.logo}
										alt={sponsor.name}
										width={sponsor.displayWidth}
										height={sponsor.displayHeight}
										className={
											sponsor.tier === SponsorTier.IN_KIND ||
											sponsor.tier === SponsorTier.BACKBENCHER
												? "h-auto w-full object-contain"
												: "h-auto max-w-full object-contain"
										}
									/>
								</Link>
							))}
						</div>
					);
				})}
			</section>
		</App>
	);
};

export default Resources;
