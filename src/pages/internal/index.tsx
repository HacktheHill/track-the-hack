import type { GetStaticProps } from "next";
import type { NextPage } from "next";
import { Role, type Prisma } from "@prisma/client";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { trpc } from "../../utils/api";
import { MetricsView } from "./metrics";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import OnlyRole from "../../components/OnlyRole";
import { useTranslation } from "next-i18next";

type PresenceInfo = Prisma.PresenceInfoGetPayload<true>;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "maps"]),
	};
};

const Internal: NextPage = () => {
	const { status: hackerStatus, ...hackerQuery } = trpc.hackers.all.useInfiniteQuery(
		{
			limit: 50,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);
	const { status: presenceStatus, ...presenceQuery } = trpc.presence.all.useInfiniteQuery(
		{
			limit: 50,
		},
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		},
	);

	const { t } = useTranslation("hackers");

	if (hackerStatus === "loading" || presenceStatus === "loading") {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<OnlyRole filter={role => role === Role.ORGANIZER}>
					<Loading />
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>
					<div className="flex flex-col items-center justify-center gap-4">
						<Error message={t("not-authorized-to-view-this-page")} />
					</div>
				</OnlyRole>
			</App>
		);
	} else if (hackerStatus === "error" || presenceStatus === "error") {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={hackerQuery.error?.message ?? presenceQuery.error?.message ?? ""} />
				</div>
			</App>
		);
	} else if (hackerStatus === "success" || presenceStatus === "success") {
		const hackers = hackerQuery.data?.pages.map(page => page.results).flat();
		const presences = presenceQuery.data?.pages.map(page => page.results).flat() as PresenceInfo[];
		console.log({ presences });

		if (!hackers) {
			return (
				<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
					<div className="flex flex-col items-center justify-center gap-4">
						<Error message={"No hackers info?"} />
					</div>
				</App>
			);
		}

		// TODO: some kind of menu for selecting internal pages
		return <MetricsView hackerData={hackers} presenceData={presences} />;
	}
};

export default Internal;
