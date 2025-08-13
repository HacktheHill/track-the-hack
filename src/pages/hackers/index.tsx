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
import Filter from "../../components/Filter";
import { rolesRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

interface Filters {
	currentSchoolOrganizations: string[];
	educationLevels: string[];
	majors: string[];
	referralSources: string[];
	presences: string[];
}

const Hackers: NextPage = () => {
	const { t } = useTranslation("hackers");

	let filterBy = {
		currentSchoolOrganizations: [] as string[],
		educationLevels: [] as string[],
		majors: [] as string[],
		referralSources: [] as string[],
		presences: [] as string[],
	} as Filters;

	const scrollRef = useRef<HTMLDivElement>(null);
	const [inputSearch, setInputSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [filters, setFilters] = useState<Filters>({
		currentSchoolOrganizations: [],
		educationLevels: [],
		majors: [],
		referralSources: [],
		presences: [],
	});
	const [sidebarVisible, setSidebarVisible] = useState(false);
	const [columns, setColumns] = useState(4);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedSearch(inputSearch);
		}, 500);

		return () => {
			clearTimeout(handler);
		};
	}, [inputSearch]);

	const { isFetching, hasNextPage, ...query } = trpc.hackers.all.useInfiniteQuery(
		{
			limit: 50,
			search: debouncedSearch,
			currentSchoolOrganizations: filters.currentSchoolOrganizations,
			educationLevels: filters.educationLevels,
			majors: filters.majors,
			referralSources: filters.referralSources,
			presences: filters.presences,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);

	const { data } = trpc.hackers.filterOptions.useQuery();

	if (data) {
		filterBy = data.filterOptions;
	}

	const hackers = query.data?.pages.map(page => page.results).flat();

	const toggleFilter = () => setSidebarVisible(!sidebarVisible);

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
						{t("filterSection.filtersButton")}
					</button>
					<Search search={inputSearch} setSearch={setInputSearch} />
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
					style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
				>
					{hackers?.map(hacker => (
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
				{hackers?.length === 0 && (
					<div className="m-4 flex h-full w-full flex-col items-center justify-center gap-4 text-2xl text-dark-color">
						<svg className="h-20 w-20" fill="currentColor" viewBox="0 0 24 24">
							<path d="M10 0h24v24H0z" fill="none" />
							<path d="M14 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
						</svg>
						<p>{t("filterSection.noHackersFound")}</p>
					</div>
				)}
			</div>
		</App>
	);
};

type CardProps = Pick<Hacker, "currentSchoolOrganization" | "firstName" | "lastName" | "major" | "id">;

const Card = ({ firstName, lastName, currentSchoolOrganization, major, id }: CardProps) => {
	const [copied, setCopied] = useState(false);
	const { t } = useTranslation("hackers");

	return (
		<Link
			href={`/hackers/hackers/hacker?id=${id}`}
			className="hover:bg-medium relative block w-full rounded-lg bg-medium-primary-color p-6 text-light-color shadow"
		>
			<Filter value={[RoleName.ACCEPTANCE]} method="some" silent>
				<button
					className="absolute right-2 top-1 text-[8pt]"
					onClick={e => {
						e.preventDefault();
						e.stopPropagation();
						void navigator.clipboard.writeText(id);
						setCopied(true);
						setTimeout(() => setCopied(false), 2000);
					}}
				>
					<small>{copied ? t("card.copied") : t("card.copyID")}</small>
				</button>
			</Filter>
			<h3 className="text-2xl font-bold tracking-tight">{`${firstName} ${lastName}`}</h3>
			<p>{major}</p>
			<p>{currentSchoolOrganization}</p>
		</Link>
	);
};

type SearchProps = {
	search: string;
	setSearch: (value: string) => void;
};

const Search = ({ search, setSearch }: SearchProps) => {
	const { t } = useTranslation("hackers");

	return (
		<div className="relative mx-auto flex max-w-xl flex-col">
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
				placeholder={t("searchPlaceholder")}
				onChange={event => setSearch(event.target.value)}
				value={search}
			/>
		</div>
	);
};

type FilterProps = {
	filters: Filters;
	setFilters: (filters: Filters) => void;
	filterOptions: {
		currentSchoolOrganizations: string[];
		educationLevels: string[];
		majors: string[];
		referralSources: string[];
		presences: string[];
	};
	sidebarVisible: boolean;
};

const FilterOptions = ({ filters, setFilters, filterOptions, sidebarVisible }: FilterProps) => {
	const { t } = useTranslation("hackers");

	const [collapsedCategories, setCollapsedCategories] = useState<Record<keyof Filters, boolean>>({
		educationLevels: true,
		currentSchoolOrganizations: true,
		majors: true,
		referralSources: true,
		presences: true,
	});

	const toggleCollapse = (category: keyof Filters) => {
		setCollapsedCategories(prev => ({
			...prev,
			[category]: !prev[category],
		}));
	};

	const handleCheckBox = (option: string, filterSection: keyof Filters) => {
		if (filters[filterSection]?.[0] === option) {
			const tempFilters = { ...filters, [filterSection]: [] };
			setFilters(tempFilters);
		} else {
			const tempFilters = { ...filters, [filterSection]: [option] };
			setFilters(tempFilters);
		}
	};

	const renderFilterSection = (options: string[], filterSection: keyof Filters) => {
		const isCollapsed = collapsedCategories[filterSection];
		const collapsibleId = `${filterSection}-collapsible`;

		return (
			<li className="block">
				<button
					className="text-dark flex w-full items-center justify-between py-2 text-left font-bold"
					onClick={() => toggleCollapse(filterSection)}
					aria-expanded={!isCollapsed}
					aria-controls={collapsibleId}
				>
					<span>{t(`filterSection.${filterSection}`)}</span>
					<span>{isCollapsed ? "+" : "-"}</span> {/* Toggle indicator */}
				</button>

				{/* Collapsible content with Tailwind CSS transition */}
				<div
					id={collapsibleId}
					className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${
						isCollapsed ? "max-h-0" : "max-h-[1000px]"
					}`}
					aria-hidden={isCollapsed}
				>
					<ul className="flex flex-wrap gap-2 pt-2">
						{options?.map(option => (
							<li key={option} className="flex w-full">
								<input
									id={`${filterSection}-${option}`}
									type="checkbox"
									className="hidden"
									checked={filters[filterSection]?.[0] === option}
									onChange={() => handleCheckBox(option, filterSection)}
								/>
								<label
									htmlFor={`${filterSection}-${option}`}
									className={`w-full cursor-pointer rounded-lg border-2 border-dark-color px-4 py-2 text-center ${
										filters[filterSection]?.[0] === option
											? "bg-medium-primary-color text-light-color"
											: "bg-light-tertiary-color text-dark-color"
									} transition-colors duration-200 hover:bg-medium-primary-color hover:text-light-color`}
								>
									{`${option.charAt(0).toUpperCase()}${option.slice(1)}`}
								</label>
							</li>
						))}
					</ul>
				</div>
			</li>
		);
	};

	return (
		<>
			{sidebarVisible && (
				<div className="border-dark text-dark flex flex-col">
					<div className="m-4 w-60 rounded-lg border-dark-color bg-light-quaternary-color p-4 text-center">
						<ul className="flex flex-col gap-4">
							{renderFilterSection(filterOptions.educationLevels, "educationLevels")}
							{renderFilterSection(
								filterOptions.currentSchoolOrganizations,
								"currentSchoolOrganizations",
							)}
							{renderFilterSection(filterOptions.majors, "majors")}
							{renderFilterSection(filterOptions.referralSources, "referralSources")}
							{renderFilterSection(filterOptions.presences, "presences")}
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
		redirect: await rolesRedirect(session, "/hackers", [RoleName.ORGANIZER, RoleName.MAYOR, RoleName.PREMIER]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["hackers", "navbar", "common"])),
		},
	};
};

export default Hackers;
