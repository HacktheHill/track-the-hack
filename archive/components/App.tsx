import type { HTMLAttributes } from "react";
import { useTranslation } from "next-i18next";
import NextHead from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";

type Props = HTMLAttributes<HTMLDivElement> & { title?: string; noIndex?: boolean; integrated?: boolean };

export default function ArchiveShell({ children, title, noIndex, integrated, ...rest }: Props) {
	void integrated;
	const { i18n } = useTranslation();
	const fr = i18n.language === "fr";
	const prefix = fr ? "/fr" : "";
	const router = useRouter();
	const currentPath = router.asPath.split(/[?#]/)[0] ?? "/";
	const unprefixed = currentPath.replace(/^\/fr(?=\/|$)/, "") || "/";
	const alternate = fr ? unprefixed : `/fr${unprefixed === "/" ? "/" : unprefixed}`;
	const items: [string, string][] = [
		["", fr ? "Accueil" : "Home"],
		["winners", fr ? "Gagnants" : "Winners"],
		["resources", fr ? "Ressources" : "Resources"],
		["metrics", fr ? "Statistiques" : "Statistics"],
	];
	return (
		<>
			<NextHead>
				<title>{title ? `${title} | Track the Hack` : "Hack the Hill III | Track the Hack"}</title>
				<meta
					name="description"
					content={
						fr
							? "Archives de Hack the Hill III : résultats, ressources et statistiques."
							: "Hack the Hill III archive: results, resources, and event statistics."
					}
				/>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/icons/favicon.svg" />
				{noIndex && <meta name="robots" content="noindex" />}
			</NextHead>
			<div className="flex min-h-screen flex-col bg-default-gradient">
				<nav
					aria-label={fr ? "Navigation des archives" : "Archive navigation"}
					className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-dark-primary-color bg-light-quaternary-color px-4 py-3 shadow-navbar"
				>
					<Link href={`${prefix}/`} aria-label={fr ? "Accueil" : "Home"}>
						{/* Static local SVG: the archive intentionally has no image server. */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src="/assets/hackthehill-logo.svg" alt="Hack the Hill" width="65" height="39" />
					</Link>
					<div className="flex flex-wrap gap-2">
						{items.map(([slug, label]) => (
							<Link key={slug} className="ui-nav-link" href={`${prefix}/${slug}/`.replace(/\/+/g, "/")}>
								{label}
							</Link>
						))}
					</div>
					<a className="ui-button ml-auto" href={alternate} hrefLang={fr ? "en" : "fr"}>
						{fr ? "EN" : "FR"}
					</a>
				</nav>
				<p
					role="note"
					className="border-b border-dark-primary-color/20 bg-white/30 px-4 py-3 text-center text-sm"
				>
					{fr
						? "Hack the Hill III · 25–27 septembre 2026"
						: "Hack the Hill III · September 25–27, 2026"}
				</p>
				<main {...rest} className={`min-w-0 flex-1 ${rest.className ?? ""}`}>
					{children}
				</main>
				<footer className="p-6 text-center">
					<a className="underline" href="https://hackthehill.com">
						hackthehill.com
					</a>
				</footer>
			</div>
		</>
	);
}
