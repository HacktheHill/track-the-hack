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
	const { status, isFetching, hasNextPage, ...query } = trpc.hackers.all.useInfiniteQuery(
		{
			limit: 50,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);

	const { t } = useTranslation("hackers");

	const [search, setSearch] = useState("");


	const [sidebarVisible, setSidebarVisible ] = useState(false)
	function toggleFilter() {
		setSidebarVisible(!sidebarVisible);
	}

	interface Filters {
		[key: string]: string[];
	}

	const [filters, setFilters] = useState<Filters>({
		schools: [],
		currentLevelsOfStudy: [],
		programs: [],
		graduationYears: [],
		attendanceTypes: [],
	});

	const [columns, setColumns] = useState(3);

	const updateColumns = useCallback(() => {
		setColumns(Math.floor(window.innerWidth / 300));
	}, []);

	const handleScroll = () => {
		const div = document?.querySelector(".mainWindow");
		if (!div) return;

		if (isFetching || !hasNextPage) return;

		// detect if user scrolled to bottom
		if (div.scrollTop >= div.scrollHeight - div.clientHeight) {
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

	if (status === "loading") {
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
	} else if (status === "error") {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={query.error?.message ?? ""} />
				</div>
			</App>
		);
	}

	const hackers = query.data?.pages.map(page => page.results).flat();

	let filteredSearchQuery =
		search.length == 0
			? hackers
			: hackers?.filter(
					hacker =>
						hacker.university?.toLowerCase().includes(search.toLowerCase()) ||
						hacker.studyProgram?.toLowerCase().includes(search.toLowerCase()) ||
						hacker.email?.toLowerCase().includes(search.toLowerCase()) ||
						`${hacker.firstName} ${hacker.lastName}`.toLowerCase().includes(search.toLowerCase()),
			  );

	if (filters) {
		if (filters["currentLevelsOfStudy"] && filters["currentLevelsOfStudy"][0]) {
			const f = filters["currentLevelsOfStudy"][0];
			filteredSearchQuery = filteredSearchQuery?.filter(hacker =>
				hacker.studyLevel?.toLowerCase().includes(f.toLowerCase()),
			);
		}

		if (filters["schools"] && filters["schools"][0]) {
			const f = filters["schools"][0];
			filteredSearchQuery = filteredSearchQuery?.filter(hacker =>
				hacker.university?.toLowerCase().includes(f.toLowerCase()),
			);
		}

		if (filters["programs"] && filters["programs"][0]) {
			const f = filters["programs"][0];
			filteredSearchQuery = filteredSearchQuery?.filter(hacker =>
				hacker.studyProgram?.toLowerCase().includes(f.toLowerCase()),
			);
		}

		if (filters["graduationYears"] && filters["graduationYears"][0]) {
			const f = filters["graduationYears"][0];
			filteredSearchQuery = filteredSearchQuery?.filter(hacker =>
				hacker.graduationYear?.toString().toLowerCase().includes(f.toLowerCase()),
			);
		}

		if (filters["attendanceTypes"] && filters["attendanceTypes"][0]) {
			const f = filters["attendanceTypes"][0];
			const isInPerson = f.toLowerCase() == "online" ? "false" : "true";
			filteredSearchQuery = filteredSearchQuery?.filter(hacker =>
				hacker.onlyOnline?.toString().toLowerCase().includes(isInPerson),
			);
		}
	}

	const filterOptions: {
		schools: string[];
		currentLevelsOfStudy: string[];
		programs: string[];
		graduationYears: string[];
		attendanceTypes: string[];
	} = {
		schools: [],
		currentLevelsOfStudy: [],
		programs: [],
		graduationYears: [],
		attendanceTypes: [],
	};

	hackers?.forEach(hacker => {
		hacker.university && !filterOptions.schools.includes(hacker.university.toLowerCase())
			? filterOptions.schools.push(hacker.university.toLowerCase())
			: "";
		hacker.studyLevel && !filterOptions.currentLevelsOfStudy.includes(hacker.studyLevel.toLowerCase())
			? filterOptions.currentLevelsOfStudy.push(hacker.studyLevel.toLowerCase())
			: "";
		hacker.studyProgram && !filterOptions.programs.includes(hacker.studyProgram.toLowerCase())
			? filterOptions.programs.push(hacker.studyProgram.toLowerCase())
			: "";
		hacker.graduationYear && !filterOptions.graduationYears.includes(hacker.graduationYear.toString())
			? filterOptions.graduationYears.push(hacker.graduationYear.toString())
			: "";
		hacker.attendanceType && !filterOptions.attendanceTypes.includes(hacker.attendanceType)
			? filterOptions.attendanceTypes.push(hacker.attendanceType)
			: "";
	});

	return (
		<App
			className="flex flex-col overflow-y-auto bg-gradient-to-b from-background2 to-background1"
			integrated={true}
			title={t("title")}
		>
			<div className="align-center flex justify-center border-b border-dark bg-background1 pb-4 pt-2 shadow-navbar sm:px-20">
				<div className="flex">
					<button
						className="m-1 mr-3 rounded-xl border-dark bg-background2 px-6 text-sm text-dark"
						onClick={toggleFilter}
					>
						Filters
					</button>
					<Search setSearch={setSearch} />
				</div>
			</div>
			<div className="flex flex-row">
				<FilterOptions
					filters={filters}
					setFilters={setFilters}
					filterOptions={filterOptions}
					sidebarVisible={sidebarVisible}
				/>
				<div
					className="mainWindow to-mobile:mx-auto grid h-fit flex-col gap-4 overflow-x-hidden px-4 py-4 sm:px-20"
					style={{
						gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
					}}
					onScroll={handleScroll}
				>
					{filteredSearchQuery &&
						filteredSearchQuery?.map(hacker => (
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
			</div>
			{filteredSearchQuery?.length == 0 && (
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
			href={`/hackers/hacker?id=${id}`}
			className="block w-full rounded-lg bg-dark p-6 text-white shadow hover:bg-medium truncate"
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
				className="block w-full rounded-lg bg-background2 p-4 pl-12 pr-8 text-sm placeholder:text-dark"
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
		schools: string[];
		currentLevelsOfStudy: string[];
		programs: string[];
		graduationYears: string[];
		attendanceTypes: string[];
	};
	sidebarVisible: boolean;
};

const FilterOptions = ({ filters, setFilters, filterOptions, sidebarVisible }: FilterProps) => {
	interface Option {
		[key: string]: string;
	}

	const [selectedOption, setSelectedOption] = useState<Option>({
		schools: "",
		currentLevelsOfStudy: "",
		programs: "",
		graduationYears: "",
		attendanceTypes: "",
	});

	const handleCheckBox = (option: string, filterSection: string) => {
		if (selectedOption[filterSection] == "" || selectedOption[filterSection] != option) {
			setSelectedOption({ ...selectedOption, [filterSection]: option });
			const tempFilters = { ...filters, [filterSection]: [] };
			tempFilters[filterSection] = [option];
			setFilters(tempFilters);
		} else if (selectedOption[filterSection] == option) {
			setSelectedOption({ ...selectedOption, [filterSection]: "" });
			const tempFilters = { ...filters, [filterSection]: [] };
			setFilters(tempFilters);
		}
	};

	return (
		<>
			{sidebarVisible && (
				<div className="ml-10 mt-5 flex flex-col border-dark align-middle text-dark">
					<div className="z-40 w-60 rounded-lg bg-background1 p-5 text-center ">
						<div className="mb-4 font-bold lg:text-lg xl:text-xl">Filter Options</div>
						<ul>
							<li className="mb-4">
								<div className="mb-2 text-left font-bold text-dark lg:text-base xl:text-lg">
									Level of Study
								</div>
								<ul>
									{filterOptions.currentLevelsOfStudy?.map(option => (
										<li key={option} className="mb-2 flex items-center justify-between text-dark">
											<span>
												{option.charAt(0).toUpperCase()}
												{option.slice(1)}
											</span>
											<input
												type="checkbox"
												className="h-6 w-6"
												checked={selectedOption["currentLevelsOfStudy"] == option}
												onChange={() => {
													handleCheckBox(option, "currentLevelsOfStudy");
												}}
											/>
										</li>
									))}
								</ul>
							</li>
							<li>
								<div className="mb-2 text-left font-bold text-dark lg:text-base xl:text-lg">School</div>
								<ul>
									{filterOptions.schools?.map(option => (
										<li key={option} className="mb-2 flex items-center justify-between text-dark">
											<span>
												{option.charAt(0).toUpperCase()}
												{option.slice(1)}
											</span>
											<input
												checked={selectedOption["schools"] == option}
												onChange={() => {
													handleCheckBox(option, "schools");
												}}
												type="checkbox"
												className="z-50 h-6 w-6"
											/>
										</li>
									))}
								</ul>
							</li>
							<li>
								<div className="mb-2 text-left font-bold text-dark lg:text-base xl:text-lg">
									Program
								</div>
								<ul>
									{filterOptions.programs?.map(option => (
										<li key={option} className="mb-2 flex items-center justify-between text-dark">
											<span>
												{option.charAt(0).toUpperCase()}
												{option.slice(1)}
											</span>
											<input
												checked={selectedOption["programs"] == option}
												onChange={() => {
													handleCheckBox(option, "programs");
												}}
												type="checkbox"
												className="z-50 h-6 w-6"
											/>
										</li>
									))}
								</ul>
							</li>
							<li>
								<div className="mb-2 text-left font-bold text-dark lg:text-base xl:text-lg">
									Graduation Year
								</div>
								<ul>
									{filterOptions.graduationYears.sort()?.map(option => (
										<li key={option} className="mb-2 flex items-center justify-between text-dark">
											<span>{option}</span>
											<input
												checked={selectedOption["graduationYears"] == option}
												onChange={() => {
													handleCheckBox(option, "graduationYears");
												}}
												type="checkbox"
												className="z-50 h-6 w-6"
											/>
										</li>
									))}
								</ul>
							</li>
							<li>
								<div className="mb-2 text-left font-bold text-dark lg:text-base xl:text-lg">
									Online/In-person
								</div>
								<ul>
									{filterOptions.attendanceTypes?.map(option => (
										<li key={option} className="mb-2 flex items-center justify-between text-dark">
											<span>
												{option.split("_").join(" ").charAt(0)}
												{option.split("_").join(" ").slice(1).toLowerCase()}
											</span>
											<input
												checked={selectedOption["attendanceTypes"] == option}
												onChange={() => {
													handleCheckBox(option, "attendanceTypes");
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
	const session = await getServerSession(req, res, authOptions);
	const props = await hackersRedirect(session, locale);

	return {
		...props,
	};
};


export default Hackers;
