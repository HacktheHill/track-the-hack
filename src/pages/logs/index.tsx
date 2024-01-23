import { Role } from "../../utils/common";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "../../components/App";

import type { GetStaticProps, NextPage } from "next";
import { useRouter } from "next/router";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import OnlyRole from "../../components/OnlyRole";
import React from "react";
import { trpc } from "../../utils/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "logs"]),
	};
};

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
	const { data: sessionData } = useSession();
	const { t } = useTranslation("logs");

	if (logsQuery.isLoading || logsQuery.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
					<Loading />
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>
					<div className="flex flex-col items-center justify-center gap-4">
						<Error message="You are not allowed to view this page" />
					</div>
				</OnlyRole>
			</App>
		);
	} else if (logsQuery.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={logsQuery.error.message} />
				</div>
			</App>
		);
	}

	if (logsQuery.data == null) {
		void router.push("/404");
	}

	const userProfile = (id: string) => {
		void router.push(`hackers/hacker?id=${id}`);
	};

	return (
		<App className="w-full overflow-y-auto bg-default-gradient p-8 sm:p-12" title={t("title")}>
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				<h1 className="text-dark-color py-2 text-center font-rubik text-4xl font-bold">AuditLogs</h1>
				<div className="relative w-full overflow-scroll">
					<div className="rounded-lg">
						<table className="w-full rounded-lg bg-light-color text-left text-sm text-gray-500">
							<thead className="bg-gray-800 text-xs uppercase text-light-color  ">
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
									<tr className="bg-default-gradient" key={log.id}>
										<td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
											{log.author ? log.author : "Unknown"}
										</td>
										<td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
											{log.action}
										</td>
										<td className="px-6 py-4">{log.timestamp.toLocaleString()}</td>
										<td className="px-6 py-4">{log.details}</td>
										<td className="px-6 py-4">{log.userId}</td>
										<td className="px-6 py-4">
											{log.action === "New follow" ? (
												<p className="px-6 py-4">No Details</p>
											) : (
												<button
													className="cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light-primary-color px-8 py-2 font-rubik text-light-color shadow-md transition-all duration-1000 hover:bg-medium-primary-color"
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
				</div>
			</OnlyRole>
			{!sessionData?.user && (
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={t("not-authorized-to-view-this-page")} />
				</div>
			)}
		</App>
	);
};
export default Logs;
