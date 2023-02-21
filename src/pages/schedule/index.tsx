import type { GetStaticProps, NextPage } from "next";
import Link from "next/link";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";

import { trpc } from "../../utils/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "schedule"]),
	};
};

const Schedule: NextPage = () => {
	const query = trpc.events.all.useQuery(undefined, {
		staleTime: 1000 * 60 * 5,
	});

	const router = useRouter();

	if (query.isLoading || query.data == null) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<Loading />
			</App>
		);
	} else if (query.isError) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
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
		<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
			<div className="flex flex-col gap-4">
				{query.data?.map((event, i) => (
					<Link
						key={event.id}
						href={`/schedule/event?id=${event.id}`}
						className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 font-[Coolvetica] text-dark ${
							i % 2 === 0 ? "bg-accent1" : "bg-accent2"
						}`}
					>
						<h1 className="text-xl">{event.name}</h1>
						<p>
							<Time time={event.start} /> - <Time time={event.end} />
						</p>
						<p>{event.room}</p>
					</Link>
				))}
			</div>
		</App>
	);
};

const Time = ({ time }: { time: Date }) => {
	return (
		<>
			{time.getHours().toString().padStart(2, "0")}:{time.getMinutes().toString().padStart(2, "0")}
		</>
	);
};

export default Schedule;
