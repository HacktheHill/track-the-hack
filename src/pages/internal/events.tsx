import type { GetServerSideProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "../../components/App";
import Loading from "../../components/Loading";
import Error from "../../components/Error";
import { trpc } from "../../server/api/api";
import { useState } from "react";
import type { Event } from "@prisma/client";
import EventEditor from "../../components/EventEditor";

const Events: NextPage = () => {
	const { t } = useTranslation("internal");
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isEditorOpen, setIsEditorOpen] = useState(false);

	const query = trpc.events.all.useQuery();

	if (query.isLoading) {
		return <Loading />;
	}

	if (query.isError) {
		return <Error message={query.error.message} />;
	}

	const sortedEvents = [...query.data].sort((a, b) => a.start.getTime() - b.start.getTime());

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated={true} title={t("title")}>
			<div className="mx-auto max-w-6xl p-8">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="font-rubik text-4xl font-bold">Events</h1>

					<button
						className="rounded-xl bg-medium-primary-color px-6 py-2 text-light-color"
						onClick={() => {
							setSelectedEvent(null);
							setIsEditorOpen(true);
						}}
					>
						New Event
					</button>
				</div>

				<div className="overflow-x-auto rounded-xl border border-dark-primary-color bg-light-quaternary-color">
					<table className="w-full text-left">
						<thead>
							<tr className="border-b border-dark-primary-color">
								<th className="p-4">Name</th>
								<th className="p-4">Location</th>
								<th className="p-4">Start</th>
								<th className="p-4">End</th>
								<th className="p-4">Visible</th>
								<th className="p-4">Actions</th>
							</tr>
						</thead>

						<tbody>
							{sortedEvents.map(event => (
								<tr key={event.id} className="border-b border-dark-primary-color last:border-b-0">
									<td className="p-4">{event.name}</td>

									<td className="p-4">{event.room}</td>

									<td className="p-4">
										{event.start.toLocaleString("en-CA", {
											year: "numeric",
											month: "numeric",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</td>

									<td className="p-4">
										{event.end.toLocaleString("en-CA", {
											year: "numeric",
											month: "numeric",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</td>

									<td className="p-4">{event.hidden ? "No" : "Yes"}</td>

									<td className="p-4">
										<button
											onClick={() => {
												setSelectedEvent(event);
												setIsEditorOpen(true);
											}}
											className="rounded border border-dark-primary-color px-4 py-2 transition-colors hover:bg-light-tertiary-color"
										>
											Edit
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{isEditorOpen && <EventEditor event={selectedEvent} onClose={() => setIsEditorOpen(false)} />}
			</div>
		</App>
	);
};
export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
	return {
		props: {
			...(await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"])),
		},
	};
};
export default Events;
