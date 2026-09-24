import type { GetServerSideProps, NextPage } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";
import { organizerRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

import App from "@/components/App";
import Access from "@/components/Access";

const Internal: NextPage = () => {
	const { t } = useTranslation("internal");

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
			<Access>
				<div className="ui-form-layout flex flex-col items-center gap-6">
					<h1 className="ui-page-title text-center">{t("title")}</h1>
					<div className="flex w-full max-w-md flex-col items-stretch gap-4 text-center">
						<Access admin silent>
							<Link href="/internal/access" className="ui-button ui-button-primary">
								{t("access.title")}
							</Link>
						</Access>
						<Link href="/internal/events" className="ui-button ui-button-primary">
							{t("events.title")}
						</Link>
						<Link href="/internal/hardware" className="ui-button ui-button-primary">
							{t("hardware")}
						</Link>
						<Link href="/internal/latte-lab" className="ui-button ui-button-primary">
							{t("latte-lab")}
						</Link>
						<Link href="/internal/notifications" className="ui-button ui-button-primary">
							{t("notifications.title")}
						</Link>
					</div>
				</div>
			</Access>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/"),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};

export default Internal;
