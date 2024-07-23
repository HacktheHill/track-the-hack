import { RoleName } from "@prisma/client";
import type { GetServerSideProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import App from "../../components/App";
import { trpc } from "../../server/api/api";
import { rolesRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

import Error from "../../components/Error";
import Filter from "../../components/Filter";
import Loading from "../../components/Loading";
import { getServerSession } from "next-auth";

interface Log {
	id: number;
	action: string;
	details: string | null;
	route: string;
	author: string;
	timestamp: Date;
	userId: string;
}

const Logs: NextPage = () => {
	const router = useRouter();
	const logsQuery = trpc.auditLog.getAllTheLogs.useQuery(undefined, { enabled: true });
	const { t } = useTranslation("logs");

	if (logsQuery.isLoading || logsQuery.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Filter value={RoleName.ORGANIZER} method="above">
					<Loading />
					<Error message={t("common:unauthorized")} />
				</Filter>
			</App>
		);
	} else if (logsQuery.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={logsQuery.error.message} />
			</App>
		);
	}

	if (logsQuery.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={t("no-logs")} />
			</App>
		);
	}

	const userProfile = (id: string) => {
		void router.push(`/hackers/hacker?id=${id}`);
	};

	return (
		<App className="w-full overflow-y-auto bg-default-gradient p-8 sm:p-12" title={t("title")}>
			<Filter value={RoleName.ORGANIZER} method="above">
				<div className="flex flex-col items-center gap-4">
					<h1 className="font-rubik text-4xl font-bold">{t("title")}</h1>
					<table className="w-full rounded-lg text-left text-sm">
						<thead className="bg-dark-primary-color text-xs uppercase text-light-color">
							<tr>
								<th scope="col" className="px-6 py-3">
									{t("user")}
								</th>
								<th scope="col" className="px-6 py-3">
									{t("action")}
								</th>
								<th scope="col" className="px-6 py-3">
									{t("timestamp")}
								</th>
								<th scope="col" className="px-6 py-3">
									{t("details")}
								</th>
								<th scope="col" className="px-6 py-3">
									{t("id")}
								</th>
								<th scope="col" className="px-6 py-3">
									Details
								</th>
							</tr>
						</thead>
						<tbody>
							{logsQuery.data.map((log: Log) => (
								<tr key={log.id} className={log.id % 2 === 0 ? "" : "bg-light-quaternary-color"}>
									<td className="whitespace-nowrap px-6 py-4 font-medium">
										{log.author ? log.author : "Unknown"}
									</td>
									<td className="whitespace-nowrap px-6 py-4 font-medium">{log.action}</td>
									<td className="px-6 py-4">{log.timestamp.toLocaleString()}</td>
									<td className="px-6 py-4">{log.details}</td>
									<td className="px-6 py-4">{log.userId}</td>
									<td className="px-6 py-4">
										{log.action === "New follow" ? (
											<p className="px-6 py-4">No Details</p>
										) : (
											<button
												className="cursor-pointer whitespace-nowrap rounded-xl border-none bg-medium-primary-color px-8 py-2 font-rubik text-light-color shadow-md transition-all duration-500 hover:bg-light-primary-color"
												onClick={() => {
													userProfile(log.userId);
												}}
											>
												Profile
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<Error message={t("common:unauthorized")} />
			</Filter>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await rolesRedirect(session, "/internal/logs", [RoleName.ORGANIZER, RoleName.ADMIN]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["logs", "navbar", "common"])),
		},
	};
};

export default Logs;
