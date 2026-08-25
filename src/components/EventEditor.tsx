import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Event } from "@prisma/client";
import { trpc } from "../server/api/api";
import { useTranslation } from "next-i18next";

type EventEditorProps = {
	event: Event | null;
	onClose: () => void;
};

type EventLink = {
	title: string;
	url: string;
};

const formatDateTimeLocal = (date: Date) => {
	const localDate = new Date(date);

	const year = localDate.getFullYear();
	const month = String(localDate.getMonth() + 1).padStart(2, "0");
	const day = String(localDate.getDate()).padStart(2, "0");
	const hours = String(localDate.getHours()).padStart(2, "0");
	const minutes = String(localDate.getMinutes()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const EventEditor = ({ event, onClose }: EventEditorProps) => {
	const [name, setName] = useState(event?.name ?? "");
	const [nameFr, setNameFr] = useState(event?.nameFr ?? "");
	const [room, setRoom] = useState(event?.room ?? "");
	const [description, setDescription] = useState(event?.description ?? "");
	const [descriptionFr, setDescriptionFr] = useState(event?.descriptionFr ?? "");
	const [start, setStart] = useState(event?.start ? formatDateTimeLocal(event.start) : "");
	const [end, setEnd] = useState(event?.end ? formatDateTimeLocal(event.end) : "");
	const [visible, setVisible] = useState(event ? !event.hidden : false);
	const [links, setLinks] = useState<EventLink[]>(
		event?.link ? [{ title: event.linkText ?? "", url: event.link }] : [],
	);
	const [imagePreview, setImagePreview] = useState<string | null>(event?.image ?? null);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);
	const { t, i18n } = useTranslation("internal");

	const utils = trpc.useUtils();

	const createEvent = trpc.events.create.useMutation({
		onSuccess: async () => {
			await utils.events.all.invalidate();
			onClose();
		},
		onError: error => {
			setError(error.message);
		},
	});

	const updateEvent = trpc.events.update.useMutation({
		onSuccess: async () => {
			await utils.events.all.invalidate();
			onClose();
		},
		onError: error => {
			setError(error.message);
		},
	});

	const addLink = () => {
		setLinks([...links, { title: "", url: "" }]);
	};

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];

		if (!file) {
			return;
		}

		setImageFile(file);
	};

	useEffect(() => {
		if (!imageFile) {
			return;
		}

		const objectUrl = URL.createObjectURL(imageFile);

		setImagePreview(objectUrl);

		return () => {
			URL.revokeObjectURL(objectUrl);
		};
	}, [imageFile]);

	const handleSave = () => {
		setError(null);

		if (!name.trim()) {
			setError(t("events.name-en-required"));
			return;
		}

		if (!nameFr.trim()) {
			setError(t("events.name-fr-required"));
			return;
		}

		if (!room.trim()) {
			setError(t("events.location-required"));
			return;
		}

		if (!start || !end) {
			setError(t("events.start-end-required"));
			return;
		}

		if (new Date(end) <= new Date(start)) {
			setError(t("events.end-after-start"));
			return;
		}

		const invalidLink = links.some(
			link => (link.title.trim() && !link.url.trim()) || (!link.title.trim() && link.url.trim()),
		);

		if (invalidLink) {
			setError(t("events.link-title-url-required"));
			return;
		}

		const firstLink = links[0];

		const eventData = {
			name: name.trim(),
			nameFr: nameFr.trim(),
			room: room.trim(),
			start: new Date(start),
			end: new Date(end),
			description: description.trim(),
			descriptionFr: descriptionFr.trim(),
			hidden: !visible,

			// Image upload is not connected yet
			image: event?.image ?? null,

			// Database currently only supports one link
			link: firstLink?.url || null,
			linkText: firstLink?.title || null,
		};

		if (event) {
			updateEvent.mutate({
				id: event.id,
				...eventData,
			});
		} else {
			createEvent.mutate(eventData);
		}
	};

	const updateLink = (index: number, field: keyof EventLink, value: string) => {
		setLinks(
			links.map((link, currentIndex) =>
				currentIndex === index
					? {
							...link,
							[field]: value,
						}
					: link,
			),
		);
	};

	const removeLink = (index: number) => {
		setLinks(links.filter((_, currentIndex) => currentIndex !== index));
	};

<<<<<<< HEAD
	const modalRoot = document.getElementById("modal-root");

	if (!modalRoot) {
		return null;
	}

	return createPortal(
	<div className="fixed inset-0 z-50 flex items-center justify-center bg-light-tertiary-color bg-opacity-90">
		<div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded border border-dark-primary-color bg-light-quaternary-color p-8 text-center">

			<h2 className="font-rubik text-2xl font-bold">{event ? "Edit Event" : "New Event"}</h2>
=======
	return (
		<Modal
			buttons={[
				{
					label: t("events.cancel"),
					onClick: onClose,
				},
				{
					label: t("events.save"),
					onClick: handleSave,
				},
			]}
		>
			<h2 className="font-rubik text-2xl font-bold">{event ? t("events.edit") : t("events.new")}</h2>
>>>>>>> bd4fcc6 (feat: add English and French localization for event editor)

			{error && <p className="rounded border border-red-500 p-2 text-left text-red-600">{error}</p>}

			<div className="flex flex-col gap-4 text-left">
				<div className="flex gap-4">
					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="event-name">{t("events.name-en")}</label>

						<input
							id="event-name"
							type="text"
							value={name}
							onChange={e => setName(e.target.value)}
							className="rounded border border-dark-primary-color p-2"
						/>
					</div>

					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="event-name-fr">{t("events.name-fr")}</label>

						<input
							id="event-name-fr"
							type="text"
							value={nameFr}
							onChange={e => setNameFr(e.target.value)}
							className="rounded border border-dark-primary-color p-2"
						/>
					</div>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="event-room">{t("events.location")}</label>

					<input
						id="event-room"
						type="text"
						value={room}
						onChange={e => setRoom(e.target.value)}
						className="rounded border border-dark-primary-color p-2"
					/>
				</div>

				<div className="flex gap-4">
					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="event-start">{t("events.start")}</label>

						<input
							id="event-start"
							type="datetime-local"
							value={start}
							onChange={e => setStart(e.target.value)}
							className="rounded border border-dark-primary-color p-2"
						/>
					</div>

					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="event-end">{t("events.end")}</label>

						<input
							id="event-end"
							type="datetime-local"
							value={end}
							onChange={e => setEnd(e.target.value)}
							className="rounded border border-dark-primary-color p-2"
						/>
					</div>
				</div>

				<div className="flex gap-4">
					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="event-description">{t("events.description-en")}</label>

						<textarea
							id="event-description"
							value={description}
							onChange={e => setDescription(e.target.value)}
							rows={4}
							className="rounded border border-dark-primary-color p-2"
						/>
					</div>

					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="event-description-fr">{t("events.description-fr")}</label>

						<textarea
							id="event-description-fr"
							value={descriptionFr}
							onChange={e => setDescriptionFr(e.target.value)}
							rows={4}
							className="rounded border border-dark-primary-color p-2"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<label htmlFor="event-image">{t("events.photo")}</label>

					{imagePreview && (
						<div className="flex flex-col gap-2">
							<img
								src={imagePreview}
								alt="Event preview"
								className="max-h-48 w-full rounded object-cover"
							/>

							<button
								type="button"
								onClick={() => {
									setImagePreview(null);
									setImageFile(null);
								}}
								className="self-start rounded border border-dark-primary-color px-3 py-1"
							>
								{t("events.remove-photo")}
							</button>
						</div>
					)}

					<input id="event-image" type="file" accept="image/*" onChange={handleImageChange} />
				</div>

				<div className="flex flex-col gap-2">
					<label>{t("events.links")}</label>

					{links.map((link, index) => (
						<div key={index} className="flex gap-2">
							<input
								type="text"
								placeholder={t("events.link-title")}
								value={link.title}
								onChange={e => updateLink(index, "title", e.target.value)}
								className="min-w-0 flex-1 rounded border border-dark-primary-color p-2"
							/>

							<input
								type="url"
								placeholder={t("events.link-url")}
								value={link.url}
								onChange={e => updateLink(index, "url", e.target.value)}
								className="min-w-0 flex-1 rounded border border-dark-primary-color p-2"
							/>

							<button
								type="button"
								onClick={() => removeLink(index)}
								className="rounded border border-dark-primary-color px-3"
							>
								{t("events.remove")}
							</button>
						</div>
					))}

					<button
						type="button"
						onClick={addLink}
						className="self-start rounded border border-dark-primary-color px-4 py-2"
					>
						+ {t("events.add-link")}
					</button>
				</div>

				<div className="flex items-center gap-2">
					<input
						id="event-visible"
						type="checkbox"
						checked={visible}
						onChange={e => setVisible(e.target.checked)}
					/>

					<label htmlFor="event-visible">{t("events.show")}</label>
				</div>
			</div>
					<div className="flex justify-center gap-4">
				<button
					type="button"
					className="whitespace-nowrap rounded-lg border border-dark-primary-color px-4 py-2 text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
					onClick={onClose}
				>
					Cancel
				</button>

				<button
					type="button"
					className="whitespace-nowrap rounded-lg border border-dark-primary-color px-4 py-2 text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
					onClick={handleSave}
				>
					Save
				</button>
			</div>
		</div>
	</div>,
	modalRoot,
);
};

export default EventEditor;
