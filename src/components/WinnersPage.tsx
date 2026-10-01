import type { NextPage } from "next";
import { useTranslation } from "next-i18next";
import App from "@/components/App";

type Project = { name: string; url: string; image: string };
type PlacedProject = Project & { place: "first" | "second" | "third"; darkImage?: boolean };
type Award =
	| "best-foss"
	| "best-ui-ux"
	| "best-hardware"
	| "mathematech"
	| "best-gemini"
	| "best-auth0"
	| "best-elevenlabs"
	| "best-vultr"
	| "best-tiger-data"
	| "best-domain-name"
	| "best-presage"
	| "best-solana";
type AwardWinner = Project & { award: Award };

export const generalWinners: PlacedProject[] = [
	{
		place: "first",
		name: "Dx – Simulated Patient Diagnosis Platform",
		url: "https://devpost.com/software/dx-patient-diagnosis-platform",
		image: "/assets/winners/dx-original.png",
	},
	{
		place: "second",
		name: "gymlens",
		url: "https://devpost.com/software/gymlens-rplve4",
		image: "/assets/winners/gymlens-original.png",
	},
	{
		place: "third",
		name: "Babbli",
		url: "https://devpost.com/software/babbli",
		image: "/assets/winners/babbli-original.png",
	},
];

export const civicWinners: PlacedProject[] = [
	{
		place: "first",
		name: "VitaSpectra",
		url: "https://devpost.com/software/tempname-sfk4wn",
		image: "/assets/winners/vitaspectra-original.png",
	},
	{
		place: "second",
		name: "Porchlight",
		url: "https://devpost.com/software/porchlight-5mtw8u",
		image: "/assets/winners/porchlight-original.png",
	},
	{
		place: "third",
		name: "evidently",
		url: "https://devpost.com/software/evidently-scdwh7",
		image: "/assets/winners/evidently-contrast.png",
		darkImage: true,
	},
];

export const cgiWinners: PlacedProject[] = [
	{
		place: "first",
		name: "NorthFlow",
		url: "https://devpost.com/software/northflow",
		image: "/assets/winners/northflow-original.png",
	},
	{
		place: "second",
		name: "TrueSight",
		url: "https://devpost.com/software/the-app-to-rule-them-all",
		image: "/assets/winners/truesight-original.png",
		darkImage: true,
	},
	{
		place: "third",
		name: "MK Solutions",
		url: "https://devpost.com/software/northwind-analysis",
		image: "/assets/winners/mk-solutions-original.png",
	},
];

export const miniChallengeWinners: AwardWinner[] = [
	{
		award: "best-foss",
		name: "Guitaroids",
		url: "https://devpost.com/software/guitaroids",
		image: "/assets/winners/guitaroids-original.jpeg",
	},
	{
		award: "best-ui-ux",
		name: "Babbli",
		url: "https://devpost.com/software/babbli",
		image: "/assets/winners/babbli-original.png",
	},
	{
		award: "best-hardware",
		name: "Flick Note",
		url: "https://devpost.com/software/patchy-4yx7uv",
		image: "/assets/winners/flick-note-original.jpg",
	},
	{
		award: "mathematech",
		name: "Babbli",
		url: "https://devpost.com/software/babbli",
		image: "/assets/winners/babbli-original.png",
	},
];

export const mlhChallengeWinners: AwardWinner[] = [
	{
		award: "best-gemini",
		name: "Mamdani",
		url: "https://devpost.com/software/hi-kwzyut",
		image: "/assets/winners/mamdani-original.png",
	},
	{
		award: "best-auth0",
		name: "Follow the Bill",
		url: "https://devpost.com/software/follow-the-bill",
		image: "/assets/winners/follow-the-bill-original.png",
	},
	{
		award: "best-elevenlabs",
		name: "Babbli",
		url: "https://devpost.com/software/babbli",
		image: "/assets/winners/babbli-original.png",
	},
	{
		award: "best-vultr",
		name: "Arrive",
		url: "https://devpost.com/software/arrive-93vmjd",
		image: "/assets/winners/arrive-original.png",
	},
	{
		award: "best-tiger-data",
		name: "What the Hill",
		url: "https://devpost.com/software/thetell",
		image: "/assets/winners/what-the-hill-original.png",
	},
	{
		award: "best-domain-name",
		name: "pleasehelpme.study",
		url: "https://devpost.com/software/youcanstilltrust-us",
		image: "/assets/winners/pleasehelpme-study-original.png",
	},
	{
		award: "best-presage",
		name: "MindSpace",
		url: "https://devpost.com/software/mind-space-zxmf28",
		image: "/assets/winners/mindspace-original.png",
	},
	{
		award: "best-solana",
		name: "Versus",
		url: "https://devpost.com/software/hth",
		image: "/assets/winners/versus-original.png",
	},
];

const ProjectLink = ({ project }: { project: Project }) => {
	const { t } = useTranslation("winners");
	return (
		<a
			href={project.url}
			target="_blank"
			rel="noreferrer"
			aria-label={t("devpost-label", { project: project.name })}
			className="mt-3 inline-flex font-semibold text-highlight-color underline decoration-2 underline-offset-4"
		>
			{t("view-project")}
		</a>
	);
};

const MainChallenge = ({ title, winners }: { title: string; winners: PlacedProject[] }) => {
	const { t } = useTranslation("winners");
	return (
		<section className="overflow-hidden rounded-2xl border border-dark-primary-color/30 bg-white/45 shadow-sm">
			<h3 className="bg-dark-primary-color px-5 py-4 text-xl font-bold text-white">{title}</h3>
			<ol className="divide-y divide-dark-primary-color/20">
				{winners.map(winner => (
					<li key={winner.place} className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
						<div
							aria-label={t(winner.place)}
							className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold ${winner.place === "first" ? "bg-medium-secondary-color text-highlight-color" : "border border-dark-primary-color/30 bg-white/60 text-dark-primary-color"}`}
						>
							{winner.place === "first" ? "1" : winner.place === "second" ? "2" : "3"}
						</div>
						<div className="min-w-0 flex-1">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={winner.image}
								alt=""
								loading="lazy"
								className={`aspect-[3/2] w-full max-w-64 rounded-xl border border-dark-primary-color/15 object-contain ${winner.darkImage ? "bg-dark-primary-color" : "bg-white/60"}`}
							/>
							<h4 className="mt-3 text-lg font-bold text-highlight-color">{winner.name}</h4>
							<ProjectLink project={winner} />
						</div>
					</li>
				))}
			</ol>
		</section>
	);
};

const AwardCards = ({ winners }: { winners: AwardWinner[] }) => {
	const { t } = useTranslation("winners");
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{winners.map(winner => (
				<section
					key={winner.award}
					className="overflow-hidden rounded-2xl border border-dark-primary-color/30 bg-white/45 shadow-sm"
				>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={winner.image}
						alt=""
						loading="lazy"
						className="aspect-[3/2] w-full bg-white/60 object-contain"
					/>
					<div className="p-5">
						<p className="font-bold tracking-wide text-dark-primary-color">{t(winner.award)}</p>
						<h3 className="mt-2 text-2xl font-bold text-highlight-color">{winner.name}</h3>
						<ProjectLink project={winner} />
					</div>
				</section>
			))}
		</div>
	);
};

const Winners: NextPage = () => {
	const { t } = useTranslation("winners");
	return (
		<App title={t("title")} className="overflow-y-auto bg-default-gradient px-4 py-6 sm:px-8 sm:py-8">
			<div className="mx-auto max-w-7xl">
				<header className="mb-6 text-center sm:mb-8">
					<h1 className="font-coolvetica text-4xl text-highlight-color sm:text-6xl">{t("title")}</h1>
					<p className="mx-auto mt-3 max-w-2xl text-lg text-dark-color sm:mt-4">{t("intro")}</p>
				</header>
				<h2 className="mb-4 text-2xl font-bold text-highlight-color">{t("main-challenges")}</h2>
				<div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
					<MainChallenge title={t("general")} winners={generalWinners} />
					<MainChallenge title={t("civic")} winners={civicWinners} />
					<MainChallenge title={t("cgi")} winners={cgiWinners} />
				</div>
				<h2 className="mb-4 mt-10 text-2xl font-bold text-highlight-color">{t("mini-challenges")}</h2>
				<AwardCards winners={miniChallengeWinners} />
				<h2 className="mb-4 mt-10 text-2xl font-bold text-highlight-color">{t("mlh-challenges")}</h2>
				<AwardCards winners={mlhChallengeWinners} />
			</div>
		</App>
	);
};

export default Winners;
