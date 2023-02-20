import type { GetStaticProps, NextPage } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import App from "../components/App";
import Error from "../components/Error";
import Loading from "../components/Loading";

import { trpc } from "../utils/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "event"]),
	};
};

const Events: NextPage = () => {
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const query = trpc.events.get.useQuery(
		{ id: id ?? "" },
		{
			enabled: !!id,
			staleTime: 1000 * 60 * 5,
		},
	);

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

	return <App>{JSON.stringify(query.data)}</App>;
};

export default Events;
