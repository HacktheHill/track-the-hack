import { RoleName } from "@prisma/client";
import type { GetServerSideProps, NextPage } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { rolesRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

import { useState } from "react";
import App from "../../components/App";
import Filter from "../../components/Filter";
import { trpc } from "../../server/api/api";

const WalkInCode: NextPage = () => {
	const { t } = useTranslation("internal");

	const [query, setQuery] = useState("");
	const [id, setId] = useState("");

	const users = trpc.users.search.useQuery({ query });
	const walkInCode = trpc.hackers.getWalkInCode.useQuery({ id });

	const handleUserSelect = (id: string) => {
		setId(id);
	};

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("walk-in-code")}>
			<Filter value={RoleName.ORGANIZER} method="above">
				<div className="ui-form-layout flex flex-col items-center gap-6">
					<h1 className="ui-page-title text-center">{t("walk-in-code")}</h1>
					<div className="flex w-full max-w-lg flex-col gap-4">
						<input
							type="search"
							placeholder={t("search")}
							aria-label={t("search")}
							className="ui-field w-full"
							onChange={e => setQuery(e.target.value)}
						/>
						<div className="flex h-[30vh] flex-col gap-3 overflow-auto rounded-lg border border-dark-primary-color bg-light-secondary-color p-4">
							{users.data?.map(user => (
								<button
									type="button"
									key={user.id}
									className="ui-button shrink-0 justify-start whitespace-normal px-4 py-3 text-left"
									onClick={() => handleUserSelect(user.id)}
								>
									<span className="pointer-events-none flex  select-none flex-wrap items-center gap-2 break-all">
										{user.image && (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={user.image} alt="User Profile" className="h-8 w-8 rounded-full" />
										)}
										{user.name} - {user.email}
									</span>
								</button>
							))}
						</div>
						{walkInCode.data && (
							<div className="relative flex flex-col gap-4 rounded-lg border border-dark-primary-color bg-light-tertiary-color p-4">
								<code className="select-all text-center font-rubik text-4xl">
									{walkInCode.data.code}
								</code>
							</div>
						)}
					</div>
				</div>
			</Filter>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await rolesRedirect(session, "/internal/walk-in-code", [RoleName.ORGANIZER]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};
export default WalkInCode;
