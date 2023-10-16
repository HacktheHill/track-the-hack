import { Prisma, Role } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";

import App from "../../components/App";

import { trpc } from "../../utils/api";
import { useRouter } from "next/router";
import Loading from "../../components/Loading";
import Error from "../../components/Error";
import OnlyRole from "../../components/OnlyRole";
import { NextPage } from "next";
import React from "react";


interface Log {
	id: number;
	action: string;
	details: string | null;
	route: string;
	author: string;
	timestamp: Date;
	user_id: string;
}

const Logs: NextPage = () => {
	const router = useRouter();
	const { t } = useTranslation("schedule");
	const [id] = [router.query.id].flat();
	const { locale } = router;

	const logsQuery = trpc.auditLog.getAllTheLogs.useQuery(undefined, { enabled: true });

	const { data: sessionData } = useSession();

	let dateLocale = "en-CA";
	if (locale === "fr") {
		dateLocale = "fr-CA";
	}

	if (logsQuery.isLoading || logsQuery.data == null) {
		return (
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
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
			<App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={logsQuery.error.message} />
				</div>
			</App>
		);
	}

	if (logsQuery.data == null) {
		void router.push("/404");
	}

	console.log(logsQuery.data);

	return (
		<App className="overflow-y-auto bg-gradient3 p-8 sm:p-12" title={t("title")}>
			<OnlyRole filter={role => role === Role.HACKER || role === Role.ORGANIZER}>
				<h1 className="py-2 text-center font-rubik text-4xl font-bold text-dark">AuditLogs</h1>
				<div className="relative overflow-x-auto">
					<div className="rounded-lg">
						<table className="w-full rounded-lg text-left text-sm text-gray-500 ">
							<thead className="bg-gray-800 text-xs uppercase text-white  ">
								<tr>
									<th scope="col" className="px-6 py-3">
										User
									</th>
									<th scope="col" className="px-6 py-3">
										Action
									</th>
									<th scope="col" className="px-6 py-3">
										Timestamp
									</th>
									<th scope="col" className="px-6 py-3">
										Details
									</th>
									<th scope="col" className="px-6 py-3">
										User ID
									</th>
								</tr>
							</thead>
							<tbody>
								{logsQuery.data.map((log: Log) => (
									<tr className="bg-background1 " key={log.id}>
										<td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
											{log.author ? log.author : "Unknown"}
										</td>
										<td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
											{log.action}
										</td>
										<td className="px-6 py-4">{log.timestamp.toLocaleString()}</td>
										<td className="px-6 py-4">{log.details}</td>
										<td className="px-6 py-4">{log.user_id}</td>
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
			<div className="sticky bottom-0 flex justify-center p-4">
				<p className="italic text-gray-500">This is a comment for non-dev people.</p>
			</div>
		</App>
	);
};
interface LogCardProps {
	log: Log;
}

const LogCard: React.FC<LogCardProps> = ({ log }) => {
	const formattedDate = log.timestamp.toLocaleString();

	return (
		<div className="h-22 w-30 m-4  flex flex-col justify-center rounded-md bg-background1 p-4 text-gray-800 ">
			<h1>
				{log.action} - <span>{formattedDate}</span>
			</h1>
			<p className="font-bold">
				({log.id}) {log.action} - {formattedDate}{" "}
			</p>
			<p>
				Some people {log.details} of id <span>{log.user_id} </span>
			</p>
		</div>
	);
};

export default Logs;
