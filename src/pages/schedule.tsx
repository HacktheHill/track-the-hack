import type { GetStaticProps, NextPage } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import App from "../components/App";
import Error from "../components/Error";
import Loading from "../components/Loading";

import { trpc } from "../utils/api";

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
			{query.data?.map(event => (
				<div key={event.id}>
					<h1>{event.name}</h1>
					<p>
						{event.time.getHours()}:{event.time.getMinutes()}
					</p>
					<p>{event.room}</p>
				</div>
			))}
		</App>
	);
};

export default Schedule;
