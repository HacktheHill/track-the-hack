import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import App from "@/components/App";
import { trpc } from "@/server/api/api";

export default function Services() {
	const { t } = useTranslation("services");
	const access = trpc.latteLab.menu.useQuery(undefined, { retry: false, staleTime: 0 });
	return (
		<App title={t("title")} className="overflow-y-auto bg-default-gradient">
			<div className="ui-form-layout space-y-6">
				<h1 className="ui-page-title">{t("title")}</h1>
				<p>{t("intro")}</p>
				{access.isError && (
					<p className="ui-panel p-4" role="alert">
						{t("session-required")}
					</p>
				)}
				{access.data && (
					<div className="grid gap-4 sm:grid-cols-2">
						<Link href="/hardware" className="ui-panel min-h-40 p-6">
							<h2 className="font-coolvetica text-2xl">{t("hardware")}</h2>
							<p>{t("hardware-description")}</p>
						</Link>
						<Link href="/latte-lab" className="ui-panel min-h-40 p-6">
							<h2 className="font-coolvetica text-2xl">{t("latte")}</h2>
							<p>{t("latte-description")}</p>
						</Link>
					</div>
				)}
			</div>
		</App>
	);
}
export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["services", "navbar", "common"]),
});
