import type { Hacker } from "@prisma/client";
import { RoleName } from "@prisma/client";
import type { NextPage } from "next";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../../server/api/api";
import { debounce } from "../../utils/helpers";

import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";
import Loading from "../../components/Loading";
import { rolesRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

const Hackers: NextPage = () => {
	interface Filters {
		[key: string]: string[];
	}

	const [filters, setFilters] = useState<Filters>({
		schools: [],
		educationLevels: [],
		major: [],
		graduationYears: [],
		attendanceTypes: [],
	});

	const { status, isFetching, hasNextPage, ...query } = trpc.hackers.all.useInfiniteQuery(
		{
			limit: 50,
			schools: filters.schools,
			educationLevels: filters.educationLevels,
			major: filters.major,
			graduationsYears: filters.graduationYears,
			attendanceTypes: filters.attendanceTypes,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);

	const { t } = useTranslation("hackers");

	const scrollRef = useRef<HTMLDivElement>(null);

	const [sidebarVisible, setSidebarVisible] = useState(false);

	const [search, setSearch] = useState("");
	const [columns, setColumns] = useState(4);

	function toggleFilter() {
		setSidebarVisible(!sidebarVisible);
	}

	const updateColumns = useCallback(() => {
		setColumns(Math.floor(window.innerWidth / 300));
	}, []);

	const handleScroll = () => {
		if (isFetching || !hasNextPage || !scrollRef.current) return;

		// Load more when scrolled to the bottom
		if (scrollRef.current.scrollTop >= scrollRef.current.scrollHeight - scrollRef.current.clientHeight) {
			void query.fetchNextPage();
		}
	};

	useEffect(() => {
		updateColumns();
		const debouncedResizeHandler = debounce(updateColumns, 500);

		window.addEventListener("resize", debouncedResizeHandler);
		return () => {
			window.removeEventListener("resize", debouncedResizeHandler);
		};
	}, [updateColumns]);

	let filterBy = {
		currentSchoolOrganizations: [],
		educationLevels: [],
		majors: [],
		referralSources: [],
	} as {
		currentSchoolOrganizations: string[];
		educationLevels: string[];
		majors: string[];
		referralSources: string[];
	};

	const { data } = trpc.hackers.filterOptions.useQuery();

	if (data) {
		filterBy = data.filterOptions;
	}

	if (status === "loading") {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Filter value={[RoleName.ORGANIZER, RoleName.SPONSOR]} method="some">
					<Loading />
					<Error message={t("common:unauthorized")} />
				</Filter>
			</App>
		);
	} else if (status === "error") {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={query.error?.message ?? ""} />
			</App>
		);
	}

	const hackers = query.data?.pages.map(page => page.results).flat();

	const filteredQuery =
		search.length == 0
			? hackers
			: hackers?.filter(
					hacker =>
						hacker.currentSchoolOrganization?.toLowerCase().includes(search.toLowerCase()) ||
						hacker.major?.toLowerCase().includes(search.toLowerCase()) ||
						`${hacker.firstName} ${hacker.lastName}`.toLowerCase().includes(search.toLowerCase()),
				);

	return (
		<App
			className="flex flex-col overflow-y-auto bg-default-gradient"
			integrated={true}
			title={t("title")}
			onScroll={handleScroll}
		>
			<div className="border-b border-dark-color bg-light-quaternary-color px-4 pb-4 pt-2 shadow-navbar sm:px-10">
				<div className="flex">
					<button
						className="border-dark m-1 mr-3 rounded-xl bg-medium-primary-color px-6 text-sm text-light-color"
						onClick={toggleFilter}
					>
						Filters
					</button>
					<Search setSearch={setSearch} />
				</div>
			</div>
			<div className="flex flex-row" ref={scrollRef}>
				<FilterOptions
					filters={filters}
					setFilters={setFilters}
					filterOptions={filterBy}
					sidebarVisible={sidebarVisible}
				/>
				<div
					className="mx-auto grid h-fit flex-col gap-4 overflow-x-hidden px-4 py-4 sm:px-10"
					style={{
						gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
					}}
				>
					{filteredQuery?.map(hacker => (
						<Card
							key={hacker.id}
							id={hacker.id}
							firstName={hacker.firstName}
							lastName={hacker.lastName}
							currentSchoolOrganization={hacker.currentSchoolOrganization}
							major={hacker.major}
						/>
					))}
				</div>
			</div>
			{filteredQuery?.length == 0 && (
				<div className="flex h-full w-full flex-col items-center justify-center gap-4 text-2xl text-dark-color">
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

type CardProps = Pick<Hacker, "currentSchoolOrganization" | "firstName" | "lastName" | "major" | "id">;

const Card = ({ firstName, lastName, currentSchoolOrganization, major, id }: CardProps) => {
	return (
		<Link
			href={`/hackers/hacker?id=${id}`}
			className="hover:bg-medium block w-full rounded-lg bg-medium-primary-color p-6 text-light-color shadow"
		>
			<h3 className="text-2xl font-bold tracking-tight">{`${firstName} ${lastName}`}</h3>
			<p>{major}</p>
			<p>{currentSchoolOrganization}</p>
		</Link>
	);
};

type SearchProps = {
	setSearch: (search: string) => void;
};

const Search = ({ setSearch }: SearchProps) => {
	return (
		<div className="relative mx-auto flex max-w-xl flex-col ">
			<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-dark-color">
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
				className="block w-full rounded-lg bg-light-tertiary-color p-4 pl-12 text-sm placeholder:text-dark-color"
				placeholder="Search Hackers"
				onChange={event => setSearch(event.target.value)}
			/>
		</div>
	);
};

interface Filters {
	[key: string]: string[];
}

type FilterProps = {
	filters: Filters;
	setFilters: (filters: Filters) => void;
	filterOptions: {
		currentSchoolOrganizations: string[];
		educationLevels: string[];
		majors: string[];
		referralSources: string[];
	};
	sidebarVisible: boolean;
};

const FilterOptions = ({ filters, setFilters, filterOptions, sidebarVisible }: FilterProps) => {
	const handleCheckBox = (option: string, filterSection: string) => {
		if (filters[filterSection]?.[0] === option) {
			const tempFilters = { ...filters, [filterSection]: [] };
			setFilters(tempFilters);
		} else {
			const tempFilters = { ...filters, [filterSection]: [option] };
			setFilters(tempFilters);
		}
	};

	return (
		<>
			{sidebarVisible && (
				<div className="border-dark text-dark ml-10 mt-5 flex flex-col align-middle">
					<div className="z-40 w-60 rounded-lg border-b border-dark-color bg-light-quaternary-color p-5 text-center ">
						<div className="mb-4 font-bold lg:text-lg xl:text-xl">Filter Options</div>
						<ul>
							<li className="mb-4">
								<div className="text-dark mb-2 text-left font-bold lg:text-base xl:text-lg">
									Level of Study
								</div>
								<ul>
									{filterOptions.educationLevels?.map(option => (
										<li key={option} className="text-dark mb-2 flex items-center justify-between">
											<span>
												{option.charAt(0).toUpperCase()}
												{option.slice(1)}
											</span>
											<input
												type="checkbox"
												className="h-6 w-6"
												checked={
													filters["educationLevels"]
														? filters["educationLevels"][0] == option
														: false
												}
												onChange={() => {
													handleCheckBox(option, "educationLevels");
												}}
											/>
										</li>
									))}
								</ul>
							</li>
							<li>
								<div className="text-dark mb-2 text-left font-bold lg:text-base xl:text-lg">School</div>
								<ul>
									{filterOptions.currentSchoolOrganizations?.map(option => (
										<li key={option} className="text-dark mb-2 flex items-center justify-between">
											<span>
												{option.charAt(0).toUpperCase()}
												{option.slice(1)}
											</span>
											<input
												checked={
													filters["currentSchoolOrganizations"]
														? filters["currentSchoolOrganizations"][0] == option
														: false
												}
												onChange={() => {
													handleCheckBox(option, "currentSchoolOrganizations");
												}}
												type="checkbox"
												className="z-50 h-6 w-6"
											/>
										</li>
									))}
								</ul>
							</li>
							<li>
								<div className="text-dark mb-2 text-left font-bold lg:text-base xl:text-lg">Major</div>
								<ul>
									{filterOptions.majors?.map(option => (
										<li key={option} className="text-dark mb-2 flex items-center justify-between">
											<span>
												{option.charAt(0).toUpperCase()}
												{option.slice(1)}
											</span>
											<input
												checked={filters["majors"] ? filters["majors"][0] == option : false}
												onChange={() => {
													handleCheckBox(option, "majors");
												}}
												type="checkbox"
												className="z-50 h-6 w-6"
											/>
										</li>
									))}
								</ul>
							</li>
							<li>
								<div className="text-dark mb-2 text-left font-bold lg:text-base xl:text-lg">
									Referral Source
								</div>
								<ul>
									{filterOptions.referralSources?.map(option => (
										<li key={option} className="text-dark mb-2 flex items-center justify-between">
											<span>
												{option.charAt(0).toUpperCase()}
												{option.slice(1)}
											</span>
											<input
												checked={
													filters["referralSources"]
														? filters["referralSources"][0] == option
														: false
												}
												onChange={() => {
													handleCheckBox(option, "referralSources");
												}}
												type="checkbox"
												className="z-50 h-6 w-6"
											/>
										</li>
									))}
								</ul>
							</li>
						</ul>
					</div>
				</div>
			)}
		</>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await rolesRedirect(session, "/hackers", [RoleName.ORGANIZER, RoleName.SPONSOR]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["hackers", "navbar", "common"])),
		},
	};
};

export default Hackers;
