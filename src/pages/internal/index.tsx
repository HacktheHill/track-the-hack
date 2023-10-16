import type { GetStaticProps } from "next";
import type { NextPage } from "next";
import { Role } from "@prisma/client";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Metrics from "./metrics";
import App from "../../components/App";
import Filter from "../../components/Filter";
import Error from "../../components/Error";
import { useTranslation } from "next-i18next";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "internal", "navbar"]),
	};
};

const Internal: NextPage = () => {
	const { t: tInternal } = useTranslation("internal");
	const { t: tCommon } = useTranslation("common");
	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={tInternal("title")}>
			{/* TODO: some kind of menu for selecting things in the internal page */}
			<Filter filter={role => role === Role.ORGANIZER}>
				<Metrics />
			</Filter>
			<Filter filter={role => role !== Role.ORGANIZER}>
				<div className="flex flex-col items-center justify-center gap-4 px-16 py-12">
					<Error message={tCommon("not-authorized-to-view-this-page")} />
				</div>
			</Filter>
		</App>
	);
};

export default Internal;