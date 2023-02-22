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
		<App className="flex h-full flex-col text-center items-center justify-start gap-4 text-dark bg-background1">
			<EventDisplay {...query.data} />
		</App>
	);
};

type EventProps = Prisma.EventGetPayload<true>;

const EventDisplay = ({ id, name, type, description, start, end, host, room, tiktok }: EventProps) => {
	return (
		<>
			<div className="flex flex-col mt-4 font-[Coolvetica]">
				<h1 className="text-xl">{name}</h1>
				<p className="text-lg">
					{start.getHours().toString()}:{start.getMinutes().toString()}&nbsp;-
					&nbsp;{end.getHours().toString()}:{end.getMinutes().toString()}
				</p>
				<p className="text-md">{room}</p>
			</div>
			<Image src="" width={300} height={300} alt=""></Image>
			<div className="flex flex-col font-[Coolvetica]">
				<h1 className="text-xl">{description}</h1>
				<p className="text-lg">{type}</p>
				<p className="text-md">{host}</p>
			</div>
			<Link
				key={id}
				href={''}
				target="_blank" 
				rel="noreferrer"
				className={`flex flex-col items-center justify-center 
				gap-2 rounded-xl p-5 px-20 mt-5 font-[Coolvetica] text-dark bg-white`}
			>
				<h1 className="text-xl">tiktok video link</h1>
			</Link>
			<Link
				key={id}
				href={''}
				className={`flex flex-col items-center justify-center 
				gap-2 rounded-xl p-5 px-20 font-[Coolvetica] text-dark bg-white`}
			>
				<h1 className="text-xl">&nbsp;&nbsp;resources link&nbsp;&nbsp;</h1>
			</Link>
		</>
	);
};

export default Event;
