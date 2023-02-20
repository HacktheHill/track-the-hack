import { PrismaClient } from "@prisma/client";
import { createProxySSGHelpers } from "@trpc/react-query/ssg";
import type { GetStaticPaths, GetStaticPropsContext, InferGetStaticPropsType } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import superjson from "superjson";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import { appRouter } from "../../server/api/root";

import { trpc } from "../../utils/api";

const prisma = new PrismaClient();

export const getStaticProps = async (context: GetStaticPropsContext<{ id: string }>) => {
	const ssg = createProxySSGHelpers({
		router: appRouter,
		// @ts-expect-error - this is a bug in the types
		ctx: {},
		transformer: superjson,
	});
	const id = context.params?.id as string;

	await ssg.events.get.prefetch({ id });
	return {
		props: {
			...(await serverSideTranslations(context.locale ?? "", ["common", "event"])),
			trpcState: ssg.dehydrate(),
			id,
		},
		revalidate: 1,
	};
};
export const getStaticPaths: GetStaticPaths = async () => {
	const events = await prisma.event.findMany({
		select: {
			id: true,
		},
	});

	return {
		paths: events.map(event => ({
			params: {
				id: event.id,
			},
		})),
		fallback: true,
	};
};

const Event = ({ id }: InferGetStaticPropsType<typeof getStaticProps>) => {
	const router = useRouter();

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

	return <App>{JSON.stringify(query.data)}</App>;
};

export default Event;
