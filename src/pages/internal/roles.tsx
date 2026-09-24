import { RoleName } from "@prisma/client";
import type { GetServerSideProps, NextPage } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { rolesRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

import { useState } from "react";
import App from "@/components/App";
import Filter from "@/components/Filter";
import { trpc } from "@/server/api/api";

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

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			await mutation.mutateAsync({ roles, userIds });
			window.location.reload();
		} catch {
			// The mutation exposes its error below and the page remains usable.
		}
	};

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("roles")}>
			<Filter value={RoleName.ADMIN} method="above">
				<div className="ui-form-layout flex flex-col items-center gap-6">
					<h1 className="ui-page-title text-center">{t("roles")}</h1>
					<form className="flex w-full max-w-lg flex-col gap-4" onSubmit={event => void handleSubmit(event)}>
						<input
							type="search"
							placeholder={t("search")}
							aria-label={t("search")}
							className="ui-field w-full"
							onChange={e => setQuery(e.target.value)}
						/>
						<div className="flex h-[30vh] flex-col gap-4 overflow-auto rounded-lg border border-dark-primary-color bg-light-secondary-color p-4">
							{users.data?.map(user => {
								const roles = user.roles.map(role => role.name);
								return (
									<div key={user.id} className="flex min-w-0 items-center gap-4">
										<input
											className="ui-checkbox"
											type="checkbox"
											id={user.id}
											name={user.id}
											checked={!!userIds.includes(user.id)}
											onChange={() => handleSelectUser(user.id, roles)}
											disabled={!!roles.find(r => r === RoleName.ADMIN)}
										/>
										<label
											htmlFor={user.id}
											className="flex min-w-0 flex-wrap items-center gap-2 break-all"
										>
											{user.image && (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={user.image}
													alt={t("user-profile")}
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
								<div key={role} className="flex min-w-0 items-center gap-4">
									<input
										className="ui-checkbox"
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
						{mutation.error && (
							<p role="alert" className="font-rubik text-red-500">
								{mutation.error.message}
							</p>
						)}
						<button type="submit" disabled={mutation.isLoading} className="ui-button ui-button-primary">
							{t("submit")}
						</button>
					</form>
				</div>
			</Filter>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: await rolesRedirect(session, "/internal/roles", [RoleName.ADMIN]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};
export default Roles;
