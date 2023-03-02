import { Role, type HackerInfo } from "@prisma/client";
import type { NextPage } from "next";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { trpc } from "../../utils/api";
import { debounce } from "../../utils/helpers";

import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import OnlyRole from "../../components/OnlyRole";
import { hackersRedirect } from "../../utils/redirects";
import { authOptions } from "../api/auth/[...nextauth]";

const Hackers: NextPage = () => {
	const { t } = useTranslation("hackers");

	const [search, setSearch] = useState("");
	const [columns, setColumns] = useState(3);

	const query = trpc.hackers.all.useQuery();

	const updateColumns = useCallback(() => {
		setColumns(Math.floor(window.innerWidth / 300));
	}, []);

	useEffect(() => {
		updateColumns();
		const debouncedResizeHandler = debounce(updateColumns, 500);

		window.addEventListener("resize", debouncedResizeHandler);
		return () => {
			window.removeEventListener("resize", debouncedResizeHandler);
		};
	}, [updateColumns]);

	if (query.isLoading || query.data == null) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
					<Loading />
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>
					<div className="flex flex-col items-center justify-center gap-4">
						<Error message={t("not-authorized-to-view-this-page")} />
					</div>
				</OnlyRole>
			</App>
		);
	} else if (query.isError) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={query.error.message} />
				</div>
			</App>
		);
	}

	const filteredQuery =
		search.length == 0
			? query.data
			: query.data.filter(
					hacker =>
						hacker.university?.toLowerCase().includes(search.toLowerCase()) ||
						hacker.studyProgram?.toLowerCase().includes(search.toLowerCase()) ||
						`${hacker.firstName} ${hacker.lastName}`.toLowerCase().includes(search.toLowerCase()),
			  );

	return (
		<App
			className="flex flex-col overflow-y-auto bg-gradient-to-b from-background2 to-background1"
			integrated={true}
			title={t("title")}
		>
			<div className="border-b border-dark bg-background1 px-4 pt-2 pb-4 shadow-navbar sm:px-20">
				<Search setSearch={setSearch} />
			</div>
			<div
				className="to-mobile:mx-auto grid h-fit flex-col gap-4 overflow-x-hidden py-4 px-4 sm:px-20"
				style={{
					gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
				}}
			>
				{filteredQuery.map(hacker => (
					<Card
						key={hacker.id}
						id={hacker.id}
						firstName={hacker.firstName}
						lastName={hacker.lastName}
						university={hacker.university}
						studyProgram={hacker.studyProgram}
					/>
				))}
			</div>
			{filteredQuery.length == 0 && (
				<div className="flex h-full w-full flex-col items-center justify-center gap-4 text-2xl text-dark">
					<svg className="h-20 w-20" fill="currentColor" viewBox="0 0 24 24">
						<path d="M10 0h24v24H0z" fill="none" />
						<path d="M14 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
					</svg>
					<p>{t("no-hackers-found")}</p>
				</div>
			)}
		</App>
	);
};

type CardProps = Pick<HackerInfo, "university" | "firstName" | "lastName" | "studyProgram" | "id">;

const Card = ({ firstName, lastName, university, studyProgram, id }: CardProps) => {
	return (
		<Link
			href={`/hackers/hacker?id=${id}`}
			className="block w-full rounded-lg bg-dark p-6 text-white shadow hover:bg-medium"
		>
			<h3 className="text-2xl font-bold tracking-tight">{`${firstName} ${lastName}`}</h3>
			<p>{university}</p>
			<p>{studyProgram}</p>
		</Link>
	);
};

type SearchProps = {
	setSearch: (search: string) => void;
};

const Search = ({ setSearch }: SearchProps) => {
	const { t } = useTranslation("hackers");

	return (
		<div className="relative mx-auto flex max-w-xl flex-col">
			<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-dark">
				<svg
					aria-hidden="true"
					className="h-5 w-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					></path>
				</svg>
			</div>
			<input
				type="search"
				id="search"
				name="search"
				className="block w-full rounded-lg bg-background2 p-4 pl-12 text-sm placeholder:text-dark"
				placeholder={t("search-hackers")}
				onChange={event => setSearch(event.target.value)}
			/>
		</div>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, authOptions);
	const props = await hackersRedirect(session, locale);

	return {
		...props,
	};
};

export default Hackers;
