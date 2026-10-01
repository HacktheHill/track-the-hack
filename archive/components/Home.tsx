import Link from "next/link";
import App from "./App";
import styles from "./Home.module.css";

function Artwork({
	name,
	width,
	height,
	className,
}: {
	name: string;
	width: number;
	height: number;
	className?: string;
}) {
	// Static local SVGs: no image service or backend is needed by the archive.
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={`/assets/hero/${name}.svg`}
			alt=""
			aria-hidden="true"
			width={width}
			height={height}
			className={className}
			draggable={false}
		/>
	);
}

export default function ArchiveHome({ locale }: { locale: "en" | "fr" }) {
	const fr = locale === "fr";
	const prefix = fr ? "/fr" : "";
	return (
		<App title="Hack the Hill III" className={styles.main}>
			<section className={styles.hero} aria-labelledby="archive-home-title">
				<div className={styles.content}>
					<div className={styles.brand}>
						<div className={styles.leaves} aria-hidden="true">
							<Artwork name="leaves" width={1440} height={913} />
						</div>
						<h1 id="archive-home-title" className={styles.wordmark}>
							<span className="sr-only">Hack the Hill III</span>
							<Artwork name="hack" width={521} height={207} />
							<span className={styles.secondLine}>
								<Artwork name="the" width={412} height={201} />
								<Artwork name="hill" width={290} height={228} />
							</span>
						</h1>
						<Artwork name="building" width={359} height={896} className={styles.building} />
					</div>
					<p className={styles.intro}>
						{fr
							? "Découvrez les projets et les moments forts de "
							: "Explore the projects and highlights from "}
						<span className="whitespace-nowrap">Hack the Hill III.</span>
					</p>
					<div className={styles.actions}>
						<Link
							href={`${prefix}/winners/`}
							className="ui-button ui-button-primary px-6 py-3 text-lg"
							data-archive-action="winners"
						>
							{fr ? "Voir les gagnants" : "View winners"}
						</Link>
						<div className={styles.secondary}>
							<Link href={`${prefix}/resources/`} data-archive-action="resources">
								{fr ? "Ressources" : "Resources"}
							</Link>
							<Link href={`${prefix}/metrics/`} data-archive-action="metrics">
								{fr ? "Statistiques" : "Statistics"}
							</Link>
						</div>
					</div>
				</div>
			</section>
		</App>
	);
}
