import type { HTMLAttributes } from "react";
import { useTranslation } from "next-i18next";
import NextHead from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import styles from "./Navigation.module.css";

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
	const items: [string, string, string][] = [
		["", fr ? "Accueil" : "Home", "home"],
		["winners", fr ? "Gagnants" : "Winners", "winners"],
		["resources", fr ? "Ressources" : "Resources", "resources"],
		["metrics", fr ? "Statistiques" : "Statistics", "metrics"],
	];
	const isCurrent = (slug: string) => {
		const path = unprefixed.replace(/\/$/, "");
		return path === (slug ? `/${slug}` : "") || (slug === "resources" && path.startsWith("/sponsors/"));
	};
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
				<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
				<link rel="icon" href="/icons/favicon.svg" />
				{noIndex && <meta name="robots" content="noindex" />}
			</NextHead>
			<div className="flex min-h-screen flex-col bg-default-gradient pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
				<nav
					aria-label={fr ? "Navigation des archives" : "Archive navigation"}
					className="sticky top-0 z-10 flex items-center gap-3 border-b border-dark-primary-color bg-light-quaternary-color px-4 py-3 shadow-navbar"
				>
					<Link href={`${prefix}/`} className="shrink-0" aria-label={fr ? "Accueil" : "Home"}>
						{/* Static local SVG: the archive intentionally has no image server. */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src="/assets/hackthehill-logo.svg" alt="Hack the Hill" width="65" height="39" />
					</Link>
					<div id="archive-nav-links" className="hidden gap-2 md:flex">
						{items.map(([slug, label]) => (
							<Link
								key={slug}
								className="ui-nav-link"
								href={`${prefix}/${slug}/`.replace(/\/+/g, "/")}
								aria-current={isCurrent(slug) ? "page" : undefined}
							>
								{label}
							</Link>
						))}
					</div>
					<a className="ui-button ml-auto shrink-0" href={alternate} hrefLang={fr ? "en" : "fr"}>
						{fr ? "EN" : "FR"}
					</a>
				</nav>
				<p
					role="note"
					className="border-b border-dark-primary-color/20 bg-white/30 px-4 py-3 text-center text-sm"
				>
					{fr ? "Hack the Hill III · 25–27 septembre 2026" : "Hack the Hill III · September 25–27, 2026"}
				</p>
				<main {...rest} className={`min-w-0 flex-1 ${rest.className ?? ""}`}>
					{children}
				</main>
				<footer className="p-6 text-center">
					<a className="underline" href="https://hackthehill.com">
						hackthehill.com
					</a>
				</footer>
				<nav
					aria-label={fr ? "Navigation inférieure" : "Bottom navigation"}
					className="ui-bottom-nav fixed inset-x-0 bottom-0 z-20 w-full items-center whitespace-nowrap border-t border-dark-primary-color bg-light-quaternary-color md:hidden"
				>
					{items.map(([slug, label, icon]) => (
						<Link
							key={slug}
							className={styles.link}
							aria-label={label}
							href={`${prefix}/${slug}/`.replace(/\/+/g, "/")}
							aria-current={isCurrent(slug) ? "page" : undefined}
						>
							{/* Reuse the live app's local icons without its image server or auth dependencies. */}
							<span className={styles.icon}>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={`/assets/${icon}.svg`} alt="" width="24" height="24" aria-hidden="true" />
							</span>
						</Link>
					))}
				</nav>
			</div>
		</>
	);
}
