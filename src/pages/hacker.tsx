import { type NextPage } from "next";
import { useRouter } from "next/router";
import { trpc } from "../utils/api";

import App from "../components/App";
import OnlyRole from "../components/OnlyRole";

import { type Prisma } from "@prisma/client";
type HackerInfo = Prisma.HackerInfoGetPayload<true>;

const Hacker: NextPage = () => {
	const router = useRouter();
	const id = router.query.id as string;

	const data = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id }).data ?? {};

	return (
		<App>
			<OnlyRole filter={role => role === "SPONSOR" || role === "ORGANIZER"}>
				<HackerView data={data as HackerInfo} />
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
