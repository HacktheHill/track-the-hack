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

const Roles: NextPage = () => {
	const { t } = useTranslation("internal");

	const [query, setQuery] = useState("");
	const [userIds, setUserIds] = useState<string[]>([]);
	const [roles, setRoles] = useState<RoleName[]>([]);

	const users = trpc.users.search.useQuery({ query });
	const mutation = trpc.users.updateRoles.useMutation();

	const handleSelectUser = (id: string, roles: RoleName[]) => {
		setRoles(roles);
		setUserIds(prev => {
			const newUsers = prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id];
			return newUsers;
		});
	};

	const handleSelectRole = (role: RoleName) => {
		setRoles(prev => {
			const newRoles = prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role];
			return newRoles;
		});
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		mutation.mutate({ roles, userIds });
		window.location.reload();
	};

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
			<Filter value={RoleName.ADMIN} method="above">
				<div className="flex h-full flex-col items-center">
					<h1 className="p-10 font-rubik text-4xl font-bold">{t("title")}</h1>
					<form className="flex w-full max-w-lg flex-col gap-4" onSubmit={handleSubmit}>
						<input
							type="search"
							placeholder="Search"
							className="py-u2 rounded-[100px] border-none bg-light-primary-color p-2 px-4 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
							onChange={e => setQuery(e.target.value)}
						/>
						<div className="flex h-[30vh] flex-col gap-4 overflow-auto rounded-lg border border-dark-primary-color bg-light-tertiary-color p-4">
							{users.data?.map(user => {
								const roles = user.roles.map(role => role.name);
								return (
									<div key={user.id} className="flex gap-4">
										<input
											type="checkbox"
											id={user.id}
											name={user.id}
											checked={!!userIds.includes(user.id)}
											onChange={() => handleSelectUser(user.id, roles)}
											disabled={!!roles.find(r => r === RoleName.ADMIN)}
										/>
										<label htmlFor={user.id} className="flex items-center gap-4">
											{user.image && (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={user.image}
													alt="User Profile"
													className="h-8 w-8 rounded-full"
												/>
											)}
											{user.name} - {user.email} ({roles.join(", ")})
										</label>
									</div>
								);
							})}
						</div>
						<div className="flex flex-col gap-4">
							{Object.values(RoleName).map(role => (
								<div key={role} className="flex gap-4">
									<input
										type="checkbox"
										id={role}
										name={role}
										checked={!!roles.includes(role)}
										onChange={() => handleSelectRole(role)}
										disabled={role === RoleName.ADMIN}
									/>
									<label htmlFor={role}>{role}</label>
								</div>
							))}
						</div>
						<button
							type="submit"
							className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
						>
							Submit
						</button>
					</form>
				</div>
			</Filter>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await rolesRedirect(session, "/internal/roles", [RoleName.ADMIN]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};
export default Roles;
