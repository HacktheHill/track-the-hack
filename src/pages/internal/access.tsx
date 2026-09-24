import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useState } from "react";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";
import { trpc } from "@/server/api/api";
import { organizerRedirect } from "@/server/lib/redirects";

export default function OrganizerAccessPage() {
	const { t } = useTranslation("internal");
	const [email, setEmail] = useState("");
	const list = trpc.users.listOrganizerAccess.useQuery();
	const utils = trpc.useContext();
	const add = trpc.users.addOrganizerAccess.useMutation({
		onSuccess: async () => {
			setEmail("");
			await utils.users.listOrganizerAccess.invalidate();
		},
	});
	const remove = trpc.users.removeOrganizerAccess.useMutation({
		onSuccess: async () => utils.users.listOrganizerAccess.invalidate(),
	});

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated title={t("access.title")}>
			<div className="ui-form-layout mx-auto flex max-w-2xl flex-col gap-6 p-6">
				<h1 className="ui-page-title text-center">{t("access.title")}</h1>
				<p className="font-rubik text-dark-color">{t("access.ctn-help")}</p>
				<form
					className="flex flex-col gap-3 sm:flex-row"
					onSubmit={event => {
						event.preventDefault();
						void add.mutateAsync({ email });
					}}
				>
					<label className="sr-only" htmlFor="organizer-email">
						{t("access.email")}
					</label>
					<input
						id="organizer-email"
						type="email"
						required
						maxLength={191}
						value={email}
						onChange={event => setEmail(event.target.value)}
						placeholder={t("access.email")}
						className="ui-field min-w-0 flex-1"
					/>
					<button type="submit" disabled={add.isLoading} className="ui-button ui-button-primary">
						{t("access.add")}
					</button>
				</form>
				{add.error && <Error message={add.error.message} />}
				{list.isLoading && <Loading />}
				{list.error && <Error message={t("common:temporarily-unavailable")} />}
				{list.data && (
					<ul className="flex flex-col gap-3">
						{list.data.length === 0 && <li className="font-rubik">{t("access.empty")}</li>}
						{list.data.map(access => (
							<li
								key={access.id}
								className="ui-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
							>
								<span className="min-w-0 flex-1 break-all font-rubik">{access.email}</span>
								<button
									type="button"
									disabled={remove.isLoading}
									onClick={() => void remove.mutateAsync({ id: access.id })}
									className="ui-button"
								>
									{t("access.remove")}
								</button>
							</li>
						))}
					</ul>
				)}
				{remove.error && <Error message={remove.error.message} />}
			</div>
		</App>
	);
}

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/internal/access", true),
		props: await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"]),
	};
};
