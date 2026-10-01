import { useEffect, useRef, useState, type HTMLAttributes } from "react";
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
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);
	useEffect(() => setMenuOpen(false), [router.asPath]);
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
					className="sticky top-0 z-10 flex items-center gap-3 border-b border-dark-primary-color bg-light-quaternary-color px-4 py-3 shadow-navbar"
					onKeyDown={event => {
						if (event.key === "Escape" && menuOpen) {
							setMenuOpen(false);
							menuButton.current?.focus();
						}
					}}
					onBlur={event => {
						if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
					}}
				>
					<Link href={`${prefix}/`} className="shrink-0" aria-label={fr ? "Accueil" : "Home"}>
						{/* Static local SVG: the archive intentionally has no image server. */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src="/assets/hackthehill-logo.svg" alt="Hack the Hill" width="65" height="39" />
					</Link>
					<div
						id="archive-nav-links"
						className={`${menuOpen ? "flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-2 border-b border-dark-primary-color bg-light-quaternary-color p-4 shadow-navbar md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
					>
						{items.map(([slug, label]) => (
							<Link
								key={slug}
								className="ui-nav-link"
								href={`${prefix}/${slug}/`.replace(/\/+/g, "/")}
								aria-current={
									unprefixed.replace(/\/$/, "") === (slug ? `/${slug}` : "") ? "page" : undefined
								}
								onClick={() => setMenuOpen(false)}
							>
								{label}
							</Link>
						))}
					</div>
					<a className="ui-button ml-auto shrink-0" href={alternate} hrefLang={fr ? "en" : "fr"}>
						{fr ? "EN" : "FR"}
					</a>
					<button
						ref={menuButton}
						type="button"
						className="ui-button flex shrink-0 items-center gap-2 md:hidden"
						aria-label={
							fr
								? menuOpen
									? "Fermer la navigation"
									: "Ouvrir la navigation"
								: menuOpen
									? "Close navigation"
									: "Open navigation"
						}
						aria-expanded={menuOpen}
						aria-controls="archive-nav-links"
						onClick={() => setMenuOpen(open => !open)}
					>
						<svg
							aria-hidden="true"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						>
							{menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
						</svg>
						Menu
					</button>
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
			</div>
		</>
	);
}
