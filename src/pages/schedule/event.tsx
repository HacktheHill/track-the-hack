import type { Event } from "@prisma/client";
import { EventType } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";

import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import { trpc } from "../../server/api/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "event"]),
	};
};

const EventPage: NextPage = () => {
	const { t } = useTranslation("event");
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const query = trpc.events.get.useQuery({ id: id ?? "" }, { enabled: !!id });

	const types = {
		[EventType.ALL]: t("type.ALL"),
		[EventType.CAREER_FAIR]: t("type.CAREER_FAIR"),
		[EventType.FOOD]: t("type.FOOD"),
		[EventType.SOCIAL]: t("type.SOCIAL"),
		[EventType.WORKSHOP]: t("type.WORKSHOP"),
	};

	return (
		<App
			className="relative flex h-full w-full flex-col items-center justify-start gap-8 overflow-y-auto bg-light-tertiary-color p-8 text-center"
			title={t("title")}
			integrated={true}
		>
			{query.isError ? (
				<Error message={query.error.message} />
			) : query.data === null || query.isLoading ? (
				<Loading />
			) : (
				<EventView event={query.data} types={types} />
			)}
		</App>
	);
};

type EventViewProps = {
	event: Event;
	types: Record<EventType, string>;
};

const EventView = ({ event, types }: EventViewProps) => {
	const { t } = useTranslation("event");
	const router = useRouter();
	const { locale } = router;

	const {
		name,
		nameFr,
		start,
		end,
		room,
		type,
		host,
		description,
		descriptionFr,
		image,
		link,
		linkText,
		linkTextFr,
		tiktok,
	} = event;

	const dateLocale = locale === "fr" ? "fr-CA" : "en-CA";

	return (
		<>
			<button
				className="absolute right-4 top-4 text-dark-primary-color transition-all duration-500 hover:scale-110 hover:text-dark-color"
				onClick={() => void router.push("/schedule")}
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<title>{t("close-event")}</title>
					<path
						d="M24 0L0 24"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					></path>
					<path
						d="M0 0L24 24"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					></path>
				</svg>
			</button>

			<div className="flex flex-col font-rubik text-dark-color">
				<h1 className="font-coolvetica text-4xl">{locale === "fr" ? nameFr : name}</h1>
				<p className="text-lg">
					{start.toLocaleDateString(dateLocale, {
						weekday: "long",
						hour: "numeric",
						minute: "numeric",
					})}
					{" - "}
					{end.toLocaleDateString(dateLocale, {
						weekday: "long",
						hour: "numeric",
						minute: "numeric",
					})}
				</p>
				<h3 className="text-md">{room}</h3>
				{type !== "ALL" && <h3 className="text-md">{types[type]}</h3>}
				<h3 className="text-sm">{host}</h3>
			</div>

			{image && (
				<div className="rounded">
					<Image src={image} width={350} height={325} alt={name} />
				</div>
			)}

			{link && (
				<Link
					href={link}
					target="_blank"
					rel="noreferrer"
					className="flex whitespace-nowrap rounded-lg border border-dark-color bg-light-primary-color px-8 py-2 font-coolvetica text-dark-color transition-colors hover:bg-dark-secondary-color"
				>
					{locale === "fr" ? linkTextFr : linkText}
				</Link>
			)}

			<div className="flex flex-col font-rubik">
				<p className="text-xl">
					{(locale === "fr" ? descriptionFr : description).split("\\n").map((line, i, arr) => (
						<span key={i}>
							{line}
							{arr.length - 1 !== i && <br />}
						</span>
					))}
				</p>
			</div>

			{tiktok && (
				<Link
					href={tiktok}
					target="_blank"
					rel="noreferrer"
					className="flex w-fit flex-row items-center justify-center gap-2 rounded-lg bg-light-color p-3 font-coolvetica text-dark-color"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="h-6 w-6">
						<path d="M412.19 118.66a109.27 109.27 0 0 1-9.45-5.5 132.87 132.87 0 0 1-24.27-20.62c-18.1-20.71-24.86-41.72-27.35-56.43h.1C349.14 23.9 350 16 350.13 16h-82.44v318.78c0 4.28 0 8.51-.18 12.69 0 .52-.05 1-.08 1.56 0 .23 0 .47-.05.71v.18a70 70 0 0 1-35.22 55.56 68.8 68.8 0 0 1-34.11 9c-38.41 0-69.54-31.32-69.54-70s31.13-70 69.54-70a68.9 68.9 0 0 1 21.41 3.39l.1-83.94a153.14 153.14 0 0 0-118 34.52 161.79 161.79 0 0 0-35.3 43.53c-3.48 6-16.61 30.11-18.2 69.24-1 22.21 5.67 45.22 8.85 54.73v.2c2 5.6 9.75 24.71 22.38 40.82A167.53 167.53 0 0 0 115 470.66v-.2l.2.2c39.91 27.12 84.16 25.34 84.16 25.34 7.66-.31 33.32 0 62.46-13.81 32.32-15.31 50.72-38.12 50.72-38.12a158.46 158.46 0 0 0 27.64-45.93c7.46-19.61 9.95-43.13 9.95-52.53V176.49c1 .6 14.32 9.41 14.32 9.41s19.19 12.3 49.13 20.31c21.48 5.7 50.42 6.9 50.42 6.9v-81.84c-10.14 1.1-30.73-2.1-51.81-12.61Z" />
					</svg>
					<h1 className="text-xl">{t("tiktok-video-link")}</h1>
				</Link>
			)}
		</>
	);
};

export default EventPage;
