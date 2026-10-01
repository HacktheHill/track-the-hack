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
	return (
		// Static local SVGs need no image server or backend.
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
	return (
		<App title="Hack the Hill III" className={styles.main} home>
			<section className={styles.hero} aria-labelledby="archive-home-title">
				<div className={styles.content}>
					<p className={styles.dates}>
						{fr ? "Du 25 au 27 septembre 2026 à Ottawa, Canada" : "Sept. 25–27, 2026 in Ottawa, Canada"}
					</p>
					<h1 id="archive-home-title" className={styles.wordmark}>
						<span className="sr-only">Hack the Hill III</span>
						<Artwork name="hack" width={521} height={207} />
						<Artwork name="the" width={412} height={201} />
						<Artwork name="hill" width={290} height={228} />
					</h1>
					<div className={styles.actions}>
						<Link
							href={`${fr ? "/fr" : ""}/winners/`}
							className="ui-button ui-button-primary px-6 py-3 text-lg"
							data-archive-action="winners"
						>
							{fr ? "Voir les gagnants" : "View winners"}
						</Link>
					</div>
				</div>
				<Artwork name="leaves" width={1440} height={913} className={styles.leaves} />
				<Artwork name="building" width={359} height={896} className={styles.building} />
			</section>
		</App>
	);
}
