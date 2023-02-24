import type { HackerInfo } from "@prisma/client";
import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { trpc } from "../../utils/api";
import Hacker from "./hacker";

import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "hackers"]),
	};
};

const Hackers = () => {
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const [search, setSearch] = useState("");

	const query = trpc.hackers.all.useQuery();

	if (query.isLoading || query.data == null) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<Loading />
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

	if (query.data == null) {
		void router.push("/404");
	}

	const filteredQuery =
		search.length == 0
			? query.data
			: query.data.filter(
					hacker =>
						hacker.firstName.toLowerCase().includes(search.toLowerCase()) ||
						hacker.lastName.toLowerCase().includes(search.toLowerCase()) ||
						hacker.university?.toLowerCase().includes(search.toLowerCase()) ||
						hacker.studyProgram?.toLowerCase().includes(search.toLowerCase()),
			  );

	return id ? (
		<Hacker />
	) : (
		<App className="flex h-full flex-col gap-8 overflow-y-auto bg-gradient-to-b from-background2 to-background1 py-8 px-4 sm:px-20">
			<Search setSearch={setSearch} />
			<div className="to-mobile:mx-auto grid h-full grid-cols-2 flex-col gap-8 overflow-x-hidden sm:grid-cols-2 lg:grid-cols-3">
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
					<p>No hackers found</p>
				</div>
			)}
		</App>
	);
};

type CardProps = Pick<HackerInfo, "university" | "firstName" | "lastName" | "studyProgram" | "id">;

const Card = ({ firstName, lastName, university, studyProgram, id }: CardProps) => {
	return (
		<Link
			href={`/hackers?id=${id}`}
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
				placeholder="Search Hackers"
				onChange={event => setSearch(event.target.value)}
			/>
		</div>
	);
};

export default Hackers;
