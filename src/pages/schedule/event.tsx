import { type Prisma, EventType } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";

import { trpc } from "../../utils/api";

const Event = () => {
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const query = trpc.events.get.useQuery(
		{ id: id ?? "" },
		{
			enabled: !!id,
			staleTime: 1000 * 60 * 5,
		},
	);

	if (query.isLoading || query.data == null || router.isFallback) {
		return (
			<App>
				<Loading />
			</App>
		);
	} else if (query.isError) {
		return (
			<App>
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={query.error.message} />
				</div>
			</App>
		);
	}

	if (query.data == null) {
		void router.push("/404");
	}

	return (
		<App className="flex h-full w-full flex-col text-center items-center justify-start gap-4 text-dark bg-background1">
			<EventDisplay {...query.data} />
		</App>
	);
};

type EventProps = Prisma.EventGetPayload<true>;

const EventDisplay = ({ id, name, type, description, start, end, host, room, tiktok }: EventProps) => {
	return (
		<>
			<Link
				key={id}
				href={"/schedule"}
				className={'absolute items-right justify-start p-2'}
				style={{marginLeft:"85%"}}
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<title>Close Event</title>
						<path d="M18 6L6 18" stroke="#3B477A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
						<path d="M6 6L18 18" stroke="#3B477A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
					</svg>
			</Link>
			<div className="flex flex-col mt-2 font-[Coolvetica]">
				<h1 className="text-xl">{name}</h1>
				<p className="text-lg">
					{start.getHours().toString()}:{start.getMinutes().toString()}&nbsp;-
					&nbsp;{end.getHours().toString()}:{end.getMinutes().toString()}
				</p>
				<p className="text-md">{room}</p>
			</div>

			<hr style={{background: "#3B477A",height: "1px",border: "none",width: "100%"}}/>

			<div style={{borderRadius: '20px', overflow: 'hidden'}}>
				<Image src="/icons/android-chrome-512x512.png" width={350} height={325} alt=""></Image>
			</div>

			<div className="flex flex-col font-[Coolvetica] mb-3">
				<h1 className="text-xl">{description}</h1>
				<p className="text-md">{type}</p>
				<p className="text-sm">{host}</p>
			</div>

			<Link
				key={id}
				href={''}
				target="_blank" 
				rel="noreferrer"
				className={`flex flex-row items-center justify-center 
				gap-2 rounded-xl p-3 font-[Coolvetica] text-dark bg-white`}
			>
				<div style={{backgroundColor:'#90A1D4', height: '4rem', width: '4rem', borderRadius: '13px', overflow: 'hidden'}}/>
				<h1 className="text-xl pl-7 pr-14 mr-7">tiktok video link</h1>
			</Link>

			<Link
				key={id}
				href={'/resources'}
				className={`flex flex-row items-center justify-center 
				gap-2 rounded-xl p-3 font-[Coolvetica] text-dark bg-white`}
			>
				<div style={{backgroundColor:'#90A1D4', height: '4rem', width: '4rem', borderRadius: '13px', overflow: 'hidden'}}/>
				<h1 className="text-xl pl-10 pr-14 mr-9">resources link</h1>
			</Link>
		</>
	);
};

export default Event;
