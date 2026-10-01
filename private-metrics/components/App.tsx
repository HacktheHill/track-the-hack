import type { HTMLAttributes } from "react";
import Head from "next/head";
import { useTranslation } from "next-i18next";

export default function PrivateMetricsShell({
	children,
	title,
	integrated,
	noIndex,
	...rest
}: HTMLAttributes<HTMLDivElement> & { title?: string; integrated?: boolean; noIndex?: boolean }) {
	void integrated;
	void noIndex;
	const { i18n } = useTranslation();
	const fr = i18n.language === "fr";
	return (
		<>
			<Head>
				<title>{`${title ?? "Metrics"} · Hack the Hill III`}</title>
				<meta name="robots" content="noindex,nofollow,noarchive" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/icons/favicon.svg" />
			</Head>
			<div className="flex min-h-screen flex-col">
				<nav
					aria-label={fr ? "Navigation des analyses" : "Analysis navigation"}
					className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 font-rubik text-sm sm:px-6"
				>
					<a href="https://tracker.hackthehill.com" className="font-medium">
						Hack the Hill III · {fr ? "Archives" : "Archive"}
					</a>
					<div className="flex items-center gap-4">
						<span className="hidden sm:inline">{fr ? "Analyses privées" : "Private analytics"}</span>
						<a className="underline" href={fr ? "/" : "/fr/"} hrefLang={fr ? "en" : "fr"}>
							{fr ? "EN" : "FR"}
						</a>
						<a className="underline" href="/cdn-cgi/access/logout">
							{fr ? "Déconnexion" : "Sign out"}
						</a>
					</div>
				</nav>
				<main {...rest} className={`min-w-0 flex-1 ${rest.className ?? ""}`}>
					{children}
				</main>
			</div>
		</>
	);
}
