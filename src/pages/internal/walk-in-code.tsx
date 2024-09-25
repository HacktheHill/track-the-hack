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
				<div className="flex h-full flex-col items-center">
					<h1 className="p-8 font-rubik text-4xl font-bold">{t("walk-in-code")}</h1>
					<div className="flex w-full max-w-lg flex-col gap-4">
						<input
							type="search"
							placeholder="Search"
							className="w-full rounded border-none bg-light-primary-color/75 px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 placeholder:text-dark-primary-color hover:bg-light-primary-color/50"
							onChange={e => setQuery(e.target.value)}
						/>
						<div className="flex h-[30vh] flex-col overflow-auto rounded-lg border border-dark-primary-color bg-light-tertiary-color p-4">
							{users.data?.map(user => (
								<div
									key={user.id}
									className="flex cursor-pointer rounded-lg p-2 hover:bg-light-primary-color/25 active:bg-light-primary-color/50"
									onClick={() => handleUserSelect(user.id)}
								>
									<label
										htmlFor={user.id}
										className="pointer-events-none flex  select-none items-center gap-4"
									>
										{user.image && (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={user.image} alt="User Profile" className="h-8 w-8 rounded-full" />
										)}
										{user.name} - {user.email}
									</label>
								</div>
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
