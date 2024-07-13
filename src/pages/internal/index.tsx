import { RoleName } from "@prisma/client";
import type { GetServerSideProps, NextPage } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { rolesRedirect } from "../../utils/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

import App from "../../components/App";
import Filter from "../../components/Filter";

const Internal: NextPage = () => {
	const { t } = useTranslation("internal");

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
			<Filter value={RoleName.ORGANIZER} method="above">
				<div className="flex h-full flex-col items-center">
					<h1 className="p-10 font-rubik text-4xl font-bold">{t("title")}</h1>
					<div className="flex flex-col items-stretch gap-4 text-center">
						<Filter value={RoleName.ADMIN} method="above" silent>
							<Link
								href="/internal/roles"
								className="cursor-pointer whitespace-nowrap rounded-xl border-none bg-medium-primary-color px-8 py-2 font-rubik text-light-color shadow-md transition-all duration-500 hover:bg-light-primary-color"
							>
								{t("roles")}
							</Link>
						</Filter>

						<Link
							href="/internal/logs"
							className="cursor-pointer whitespace-nowrap rounded-xl border-none bg-medium-primary-color px-8 py-2 font-rubik text-light-color shadow-md transition-all duration-500 hover:bg-light-primary-color"
						>
							{t("logs")}
						</Link>
						<Link
							href="/internal/sponsorship-gmail-drafts"
							className="cursor-pointer whitespace-nowrap rounded-xl border-none bg-medium-primary-color px-8 py-2 font-rubik text-light-color shadow-md transition-all duration-500 hover:bg-light-primary-color"
						>
							{t("sponsorship-gmail-drafts")}
						</Link>
						<Link
							href="/internal/metrics"
							className="cursor-pointer whitespace-nowrap rounded-xl border-none bg-medium-primary-color px-8 py-2 font-rubik text-light-color shadow-md transition-all duration-500 hover:bg-light-primary-color"
						>
							{t("metrics")}
						</Link>
					</div>
				</div>
			</Filter>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await rolesRedirect(session, "/", [RoleName.ORGANIZER, RoleName.ADMIN]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};

export default Internal;
