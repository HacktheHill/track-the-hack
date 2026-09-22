import { RoleName } from "@prisma/client";
import type { GetServerSideProps, NextPage } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { rolesRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

import App from "@/components/App";
import Filter from "@/components/Filter";

const Internal: NextPage = () => {
	const { t } = useTranslation("internal");

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
			<Filter value={RoleName.ORGANIZER} method="above">
				<div className="ui-form-layout flex flex-col items-center gap-6">
					<h1 className="ui-page-title text-center">{t("title")}</h1>
					<div className="flex w-full max-w-md flex-col items-stretch gap-4 text-center">
						<Filter value={RoleName.ADMIN} method="above" silent>
							<Link href="/internal/roles" className="ui-button ui-button-primary">
								{t("roles")}
							</Link>
						</Filter>
						<Link href="/internal/events" className="ui-button ui-button-primary">
							{t("events.title")}
						</Link>
					</div>
				</div>
			</Filter>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: await rolesRedirect(session, "/", [RoleName.ORGANIZER, RoleName.ADMIN]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};

export default Internal;
