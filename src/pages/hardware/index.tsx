import type { NextPage } from "next";
import { useTranslation } from "next-i18next";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "../../components/App";
import { hackersRedirect } from "../../utils/redirects";
import { authOptions } from "../api/auth/[...nextauth]";
import { useState } from "react";
import { Button } from "@nextui-org/button";
import Image from "next/image";

const Hardware: NextPage = () => {
	const [search, setSearch] = useState<string>("");

	type hardwareItem = {
		id: number;
		name: string;
		quantityAvailable: number;
		model: string;
		manufacturer: string;
		description: string;
        imgSrc: string;
	};
	// Mock list of hardware items
	const hardwareList: hardwareItem[] = [
		{
			id: 1,
			name: "Raspberry Pi Zero",
			quantityAvailable: 5,
			model: "SC0918",
			manufacturer: "Raspberry Pi",
			description:
				"Lorem ipsum dolor, sit amet consectetur adipisicing elit. Corrupti praesentium nihil dignissimos vero deleniti quibusdam nesciunt laborum aut pariatur esse, facere rem consectetur, temporibus cupiditate saepe adipisci architecto. Sed, odit?",
            imgSrc: "https://m.media-amazon.com/images/I/715lLPSw2GL._AC_UF1000,1000_QL80_.jpg"
        },
        {
			id: 1,
			name: "Raspberry Pi Zero",
			quantityAvailable: 5,
			model: "SC0918",
			manufacturer: "Raspberry Pi",
			description:
				"Lorem ipsum dolor, sit amet consectetur adipisicing elit. Corrupti praesentium nihil dignissimos vero deleniti quibusdam nesciunt laborum aut pariatur esse, facere rem consectetur, temporibus cupiditate saepe adipisci architecto. Sed, odit?",
            imgSrc: "https://m.media-amazon.com/images/I/715lLPSw2GL._AC_UF1000,1000_QL80_.jpg"
        },
        {
			id: 1,
			name: "Raspberry Pi Zero",
			quantityAvailable: 5,
			model: "SC0918",
			manufacturer: "Raspberry Pi",
			description:
				"Lorem ipsum dolor, sit amet consectetur adipisicing elit. Corrupti praesentium nihil dignissimos vero deleniti quibusdam nesciunt laborum aut pariatur esse, facere rem consectetur, temporibus cupiditate saepe adipisci architecto. Sed, odit?",
            imgSrc: "https://m.media-amazon.com/images/I/715lLPSw2GL._AC_UF1000,1000_QL80_.jpg"
        },
	];

	return (
		<App className="flex flex-col overflow-y-auto bg-default-gradient" integrated={true}>
			<div className=" border-b border-dark-color bg-light-quaternary-color px-4 pb-4 pt-2 shadow-navbar sm:px-20">
				<Search setSearch={setSearch} />
			</div>
			<div
				className="mainWindow to-mobile:mx-auto grid h-4/5 h-fit flex-col gap-4 overflow-x-hidden px-4 py-4 sm:px-20"
				// style={{
				// 	gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
				// }}
			>
				{hardwareList?.map(hardware => (
					<HardwareCard
						key={hardware.id}
						name={hardware.name}
						quantityAvailable={hardware.quantityAvailable}
						model={hardware.model}
						manufacturer={hardware.manufacturer}
						description={hardware.description}
                        imgSrc={hardware.imgSrc}
					/>
				))}
			</div>
			<div className="flex h-1/5 w-11/12 w-full items-center justify-end">
				<button className="m-1 mr-3 rounded-xl border-black bg-medium-primary-color p-3 px-6 text-sm text-light-color">
					Checkout
				</button>
			</div>
			{/* {hardwareList?.length == 0 && (
				<div className="flex h-full w-full flex-col items-center justify-center gap-4 text-2xl text-dark-color">
					<svg className="h-20 w-20" fill="currentColor" viewBox="0 0 24 24">
						<path d="M10 0h24v24H0z" fill="none" />
						<path d="M14 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
					</svg>
					<p>No hackers found</p>
				</div>
			)} */}
		</App>
	);
};

type HardwareCardProps = {
	name: string;
	quantityAvailable: number;
	model: string;
	manufacturer: string;
	description: string;
    imgSrc: string;
};

const HardwareCard = ({ name, quantityAvailable, model, manufacturer, description, imgSrc }: HardwareCardProps) => {
	return (
		<div className="hover:bg-medium flex w-full rounded-lg bg-medium-primary-color p-6 text-light-color shadow">
			<div className="h-full w-1/12 mx-3 border-dark flex justify-center items-center">
				<Image
					width={200}
					height={200}
					alt="Picture of hardware"
					src={imgSrc}
				></Image>
			</div>
			<div className="h-full w-9/12">
				<h3 className="text-xl font-bold tracking-tight">{`${name}`}</h3>
				<div className="m-5 flex flex-row items-center justify-evenly">
					<p>Manufacturer: {manufacturer}</p>
					<p>Model: {model}</p>
					<p>Quantity Available: {quantityAvailable}</p>
					<p>
						Quantity Requested: <input className="p-1 text-black" type="number" min="0" max="100" />
					</p>
				</div>
				<p className="text-xs">Description: {description}</p>
			</div>
			<div className="flex w-1/12 items-center justify-center ">
				<div className="m-3 flex h-full items-end justify-center">
					<Button>ADD</Button>
				</div>
			</div>
		</div>
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
				placeholder="Search hardware by name"
				onChange={event => setSearch(event.target.value)}
			/>
		</div>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, authOptions);

	return {
		props: {
			...(await hackersRedirect(session)),
			...(await serverSideTranslations(locale ?? "en", ["hackers", "navbar", "common"])),
		},
	};
};

export default Hardware;
