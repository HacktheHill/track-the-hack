import type { GetServerSideProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "@/components/App";
import Loading from "@/components/Loading";
import Error from "@/components/Error";
import { trpc } from "@/server/api/api";
import { useState } from "react";
import EventEditor from "@/components/EventEditor";
import { getServerSession } from "next-auth";
import { organizerRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";
import type { RouterOutputs } from "@/server/api/api";
import { getEventRoom } from "@/utils/event-room";

type ManagedEvent = RouterOutputs["events"]["manage"][number];

const Events: NextPage = () => {
	const { t, i18n } = useTranslation("internal");
	const dateLocale = i18n.language === "fr" ? "fr-CA" : "en-CA";
	const [selectedEvent, setSelectedEvent] = useState<ManagedEvent | null>(null);
	const [isEditorOpen, setIsEditorOpen] = useState(false);

	const query = trpc.events.manage.useQuery();
	const closeEditor = () => {
		setIsEditorOpen(false);
		setSelectedEvent(null);
	};

	if (query.isLoading) {
		return (
			<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
				<Loading />
			</App>
		);
	}

	if (query.isError) {
		return (
			<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
				<Error message={t("common:temporarily-unavailable")} />
			</App>
		);
	}

	const sortedEvents = [...query.data].sort((a, b) => a.start.getTime() - b.start.getTime());

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
			<div className="mx-auto max-w-6xl p-4 sm:p-8">
				<div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
					<h1 className="ui-page-title">{t("events.title")}</h1>

					<button
						className="ui-button ui-button-primary"
						onClick={() => {
							setSelectedEvent(null);
							setIsEditorOpen(true);
						}}
					>
						+ {t("events.new")}
					</button>
				</div>

				<div className="overflow-x-auto rounded-xl border border-dark-primary-color bg-light-quaternary-color">
					<table className="w-full text-left">
						<thead>
							<tr className="border-b border-dark-primary-color">
								<th className="p-4">{t("events.table.name")}</th>
								<th className="p-4">{t("events.table.location")}</th>
								<th className="p-4">{t("events.table.start")}</th>
								<th className="p-4">{t("events.table.end")}</th>
								<th className="p-4">{t("events.table.visible")}</th>
								<th className="p-4">{t("events.table.actions")}</th>
							</tr>
						</thead>

						<tbody>
							{sortedEvents.map(event => (
								<tr key={event.id} className="border-b border-dark-primary-color last:border-b-0">
									<td className="p-4">{event.name}</td>

									<td className="p-4">{getEventRoom(event, i18n.language)}</td>

									<td className="p-4">
										{event.start.toLocaleString(dateLocale, {
											year: "numeric",
											month: "numeric",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</td>

									<td className="p-4">
										{event.end.toLocaleString(dateLocale, {
											year: "numeric",
											month: "numeric",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</td>

									<td className="p-4">{event.hidden ? t("events.no") : t("events.yes")}</td>

									<td className="p-4">
										<button
											onClick={() => {
												setSelectedEvent(event);
												setIsEditorOpen(true);
											}}
											className="ui-button"
										>
											{t("events.edit")}
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{isEditorOpen && <EventEditor event={selectedEvent} onClose={closeEditor} />}
			</div>
		</App>
	);
};
export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/internal/events"),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};

export default Events;
