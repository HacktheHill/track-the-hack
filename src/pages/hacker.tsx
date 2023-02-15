import { type NextPage } from "next";
import { useRouter } from "next/router";
import { trpc } from "../utils/api";
import type { z } from "zod";

import App from "../components/App";
import OnlyRole from "../components/OnlyRole";

import type { roles } from "../utils/common";
import { type Prisma } from "@prisma/client";
type Hacker = Prisma.HackerInfoGetPayload<true>;

const Hacker: NextPage = () => {
	const router = useRouter();
	const id = router.query.id as string;

	const data = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id }).data ?? {};

	return (
		<App>
			<OnlyRole filter={(role: z.infer<typeof roles> | null) => role === "SPONSOR" || role === "ORGANIZER"}>
				<HackerView data={data as Hacker} />
			</OnlyRole>
			<OnlyRole filter={(role: z.infer<typeof roles> | null) => role === "HACKER"}>
				You are not authorized to view this page.
			</OnlyRole>
		</App>
	);
};

const HackerView = ({ data }: { data: Hacker }) => {
	return (
		<div>
			<h1 className="font-[Coolvetica] text-[clamp(1rem,3.5vmin,5rem)]  font-normal text-dark">
				{data.firstName} {data.lastName}
			</h1>
			{...Object.keys(data).map(key => (
				<div key={key}>
					<b>{key}</b>: {(data[key as keyof Hacker] ?? "NULL").toString()}
				</div>
			))}
		</div>
	);
};

export default Hacker;
