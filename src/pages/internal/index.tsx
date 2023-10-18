import type { GetStaticProps } from "next";
import type { NextPage } from "next";
import { Role } from "@prisma/client";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Metrics from "./metrics";
import App from "../../components/App";
import OnlyRole from "../../components/OnlyRole";
import Error from "../../components/Error";
import { useTranslation } from "next-i18next";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "internal", "navbar"]),
	};
};

const Internal: NextPage = () => {
	const { t } = useTranslation(["common", "internal", "navbar"]);
	return (
		<App
			className="overflow-y-auto bg-gradient-to-b from-background2 to-background1"
			integrated={true}
			title={t("title")}
		>
			{/* TODO: some kind of menu for selecting internal pages */}
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				<Metrics />
			</OnlyRole>
			<OnlyRole filter={role => role !== Role.ORGANIZER}>
				<div className="flex flex-col items-center justify-center gap-4 px-16 py-12">
					<Error message={t("not-authorized-to-view-this-page")} />
				</div>
			</OnlyRole>
		</App>
	);
};

export default Internal;
