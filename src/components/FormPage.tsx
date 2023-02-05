import type { HackerInfo } from "@prisma/client";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useTranslation } from "next-i18next";

type FormPageProps = {
	children: React.ReactNode;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	error?: string;
	invalid: string | null;
	loading: boolean;
	path: `/${string}` | null;
	user: HackerInfo | null;
	title: string;
};

const FormPage = ({ children, onSubmit, error, invalid, loading, path, user, title }: FormPageProps) => {
	const { t } = useTranslation("common");

	// Get query params
	const router = useRouter();

	useEffect(() => {
		if (user && path) {
			if (user.preferredLanguage.toLowerCase() !== router.locale) {
				void router.push(path, undefined, {
					locale: user.preferredLanguage.toLowerCase(),
				});
			}
		}
	}, [user, router, path]);

	return (
		<>
			<Head>
				<title>Track the Hack | {title}</title>
				<meta
					name="description"
					content="An open source project to track the participants of the Hack the Hill hackathon."
				/>
				<link rel="shortcut icon" href="/favicon.svg" type="image/svg+xml" />
			</Head>
			<main className="flex h-screen flex-col items-center justify-center bg-gradient bg-no-repeat text-center supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
				<form onSubmit={onSubmit} className="flex flex-col items-center justify-center gap-6 px-12 text-center">
					<div className="flex flex-col items-center">
						<Image
							src="https://hackthehill.com/Logos/hackthehill-logo.svg"
							alt="Hack the Hill logo"
							width={128}
							height={128}
							className="h-auto w-auto"
						/>
						<h1 className="font-[Coolvetica] text-[clamp(1rem,3.5vmin,5rem)]  font-normal text-dark">
							Hack the Hill
						</h1>
					</div>
					{invalid && <p>{invalid}</p>}
					{!invalid && loading && !error && (
						<div className="flex flex-col items-center justify-center">
							<svg
								className="h-10 w-10 animate-spin text-dark"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<path fill="currentColor" d="M4 12a8 8 0 018-8v1a7 7 0 00-7 7h1z"></path>
							</svg>
							{t("loading")}
						</div>
					)}
					{error && (
						<>
							<code>
								{t("error", {
									message: error,
								})}
							</code>
							<a href="mailto:development@hackthehill.com" target="_blank" rel="noreferrer">
								<button
									type="button"
									className="transform cursor-pointer whitespace-nowrap rounded-normal border-2 border-light px-[calc(2*clamp(.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-[Rubik] text-[clamp(1rem,1vmin,5rem)] text-light shadow-[0_15px_25px_rgba(0,_0,_0,_0.15),_0_5px_10px_rgba(0,_0,_0,_0.05)] transition hover:bg-white/50"
								>
									{t("contact-us")}
								</button>
							</a>
						</>
					)}
					{!invalid && !error && !loading && (
						<div className="flex max-w-[25rem] flex-col items-center gap-6">{children}</div>
					)}
				</form>
			</main>
		</>
	);
};

export default FormPage;
