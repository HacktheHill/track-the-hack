import fs from "node:fs";
import path from "node:path";
import type { GetStaticPaths, GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Winners from "@/components/WinnersPage";
import Resources from "@/components/ResourcesPage";
import Sponsor from "@/components/SponsorPage";
import { sponsorsData, type SponsorData } from "@/client/sponsors";
import App from "@root/archive/components/App";
import ArchiveHome from "@root/archive/components/Home";
import { archiveI18n } from "@root/archive/i18n";
import { publicMetricsSchema, type PublicMetrics } from "@root/archive/metrics";

type Props = { archiveLocale: "en" | "fr"; view: string; sponsor?: SponsorData; metrics: PublicMetrics };

export const getStaticPaths: GetStaticPaths = () => ({
	paths: ["en", "fr"].flatMap(locale =>
		[[], ["winners"], ["resources"], ["metrics"], ...sponsorsData.map(sponsor => ["sponsors", sponsor.id])].map(
			route => ({
				params: { path: locale === "fr" ? ["fr", ...route] : route },
			}),
		),
	),
	fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
	const parts = Array.isArray(params?.path) ? params.path : [];
	const archiveLocale = parts[0] === "fr" ? "fr" : "en";
	const route = archiveLocale === "fr" ? parts.slice(1) : parts;
	const view = route[0] ?? "home";
	const sponsor = view === "sponsors" ? sponsorsData.find(item => item.id === route[1]) : undefined;
	const snapshotPath = process.env.ARCHIVE_METRICS_FILE || path.join(process.cwd(), "data/metrics.json");
	const metrics = publicMetricsSchema.parse(JSON.parse(fs.readFileSync(snapshotPath, "utf8")));
	return {
		props: {
			archiveLocale,
			view,
			...(sponsor ? { sponsor } : {}),
			metrics,
			...(await serverSideTranslations(
				archiveLocale,
				["common", "navbar", "winners", "resources", "sponsors"],
				archiveI18n,
			)),
		},
	};
};

export default function ArchivePage({ archiveLocale, view, sponsor, metrics }: Props) {
	const fr = archiveLocale === "fr";
	const prefix = fr ? "/fr" : "";
	if (view === "winners") return <Winners />;
	if (view === "resources") return <Resources contentLocale={archiveLocale} linkPrefix={prefix} />;
	if (sponsor) return <Sponsor {...sponsor} />;
	if (view === "metrics") {
		const values: [string, string | number][] = [
			[fr ? "Participants" : "Participants", `${metrics.participants}${metrics.participantsAtLeast ? "+" : ""}`],
			[fr ? "Hackers" : "Hackers", metrics.hackers],
			[fr ? "Organisateurs" : "Organisers", metrics.organisers],
			[fr ? "Bénévoles" : "Volunteers", `${metrics.volunteers}${metrics.volunteersAtLeast ? "+" : ""}`],
			[fr ? "Projets soumis" : "Submitted projects", metrics.projects],
			[fr ? "Ateliers" : "Workshops", metrics.workshops],
		];
		return (
			<App title={fr ? "Statistiques" : "Statistics"} className="p-6 sm:p-12">
				<section className="mx-auto max-w-5xl">
					<h1 className="ui-page-title">
						{fr ? "Hack the Hill III en chiffres" : "Hack the Hill III by the numbers"}
					</h1>
					<p className="my-4">
						{fr
							? "Statistiques communiquées par les organisateurs, en date du"
							: "Organiser-reported statistics as of"}{" "}
						{metrics.asOf}.
					</p>
					{metrics.preliminary && (
						<p className="mb-6">
							{fr
								? "Ces chiffres sont préliminaires et seront mis à jour une fois confirmés."
								: "These figures are preliminary and will be updated once confirmed."}
						</p>
					)}
					<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{values.map(([label, value]) => (
							<div
								key={label}
								className="rounded-2xl border border-dark-primary-color/30 bg-white/45 p-6"
							>
								<dt className="text-lg">{label}</dt>
								<dd className="mt-2 text-4xl font-bold text-highlight-color">{value}</dd>
							</div>
						))}
					</dl>
				</section>
			</App>
		);
	}
	return <ArchiveHome locale={archiveLocale} />;
}
