import { type Prisma, EventType } from "@prisma/client";
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
		<App>
			{query.data.map(data => (
				<EventDisplay key={data.id} {...data} />
			))}
		</App>
	);
};

type EventProps = Prisma.EventGetPayload<true>;

const EventDisplay = ({ id, name, type, description, start, end, host, room, tiktok }: EventProps) => {
	return null;
};

export default Event;
