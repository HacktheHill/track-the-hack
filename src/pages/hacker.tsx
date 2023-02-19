import { type NextPage } from "next";
import { useRouter } from "next/router";
import { trpc } from "../utils/api";

import App from "../components/App";
import OnlyRole from "../components/OnlyRole";

import { type Prisma } from "@prisma/client";
import { useEffect } from "react";
import Loading from "../components/Loading";
type HackerInfo = Prisma.HackerInfoGetPayload<true>;

const Hacker: NextPage = () => {
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const query = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });

	useEffect(() => {
		if (!query.isLoading && !query.data) {
			void router.push("/");
		}
	}, [query.data, query.isLoading, router]);

	if (query.isLoading || !query.data) {
		return <Loading />;
	}

	return (
		<App>
			<OnlyRole filter={role => role === "SPONSOR" || role === "ORGANIZER"}>
				<HackerView data={query.data} />
			</OnlyRole>
			<OnlyRole filter={role => role === "HACKER"}>You are not authorized to view this page.</OnlyRole>
		</App>
	);
};

const HackerView = ({ data }: { data: HackerInfo }) => {
	return (
		<div>
			<h1 className="font-[Coolvetica] text-[clamp(1rem,3.5vmin,5rem)]  font-normal text-dark">
				{data.firstName} {data.lastName}
			</h1>
			{...Object.keys(data).map(key => (
				<div key={key}>
					<b>{key}</b>: {(data[key as keyof HackerInfo] ?? "NULL").toString()}
				</div>
			))}
		</div>
	);
};

export default Hacker;
