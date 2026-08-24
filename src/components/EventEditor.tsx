import { useEffect, useState } from "react";
import type { Event } from "@prisma/client";
import Modal from "./Modal";

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
	const [room, setRoom] = useState(event?.room ?? "");
	const [description, setDescription] = useState(event?.description ?? "");
	const [start, setStart] = useState(event?.start ? formatDateTimeLocal(event.start) : "");
	const [end, setEnd] = useState(event?.end ? formatDateTimeLocal(event.end) : "");
	const [visible, setVisible] = useState(event ? !event.hidden : false);
	const [links, setLinks] = useState<EventLink[]>(
		event?.link ? [{ title: event.linkText ?? "", url: event.link }] : [],
	);
	const addLink = () => {
		setLinks([...links, { title: "", url: "" }]);
	};
	const [imagePreview, setImagePreview] = useState<string | null>(event?.image ?? null);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);

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
			setError("Event name is required.");
			return;
		}

		if (!room.trim()) {
			setError("Event location is required.");
			return;
		}

		if (!start || !end) {
			setError("Start and end times are required.");
			return;
		}

		if (new Date(end) <= new Date(start)) {
			setError("End time must be after start time.");
			return;
		}

		const invalidLink = links.some(
			link => (link.title.trim() && !link.url.trim()) || (!link.title.trim() && link.url.trim()),
		);

		if (invalidLink) {
			setError("Each link must have both a title and a URL.");
			return;
		}

		console.log({
			name,
			room,
			start,
			end,
			description,
			imageFile,
			links,
			hidden: !visible,
		});
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

	return (
		<Modal
			buttons={[
				{
					label: "Cancel",
					onClick: onClose,
				},
				{
					label: "Save",
					onClick: handleSave,
				},
			]}
		>
			<h2 className="font-rubik text-2xl font-bold">{event ? "Edit Event" : "New Event"}</h2>

			{error && <p className="rounded border border-red-500 p-2 text-left text-red-600">{error}</p>}

			<div className="flex flex-col gap-4 text-left">
				<div className="flex flex-col gap-1">
					<label htmlFor="event-name">Event name</label>

					<input
						id="event-name"
						type="text"
						value={name}
						onChange={e => setName(e.target.value)}
						className="rounded border border-dark-primary-color p-2"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="event-room">Location</label>

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
						<label htmlFor="event-start">Start</label>

						<input
							id="event-start"
							type="datetime-local"
							value={start}
							onChange={e => setStart(e.target.value)}
							className="rounded border border-dark-primary-color p-2"
						/>
					</div>

					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="event-end">End</label>

						<input
							id="event-end"
							type="datetime-local"
							value={end}
							onChange={e => setEnd(e.target.value)}
							className="rounded border border-dark-primary-color p-2"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="event-description">Description</label>

					<textarea
						id="event-description"
						value={description}
						onChange={e => setDescription(e.target.value)}
						rows={4}
						className="rounded border border-dark-primary-color p-2"
					/>
				</div>

				<div className="flex flex-col gap-2">
					<label htmlFor="event-image">Event photo</label>

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
								Remove photo
							</button>
						</div>
					)}

					<input id="event-image" type="file" accept="image/*" onChange={handleImageChange} />
				</div>

				<div className="flex flex-col gap-2">
					<label>Links</label>

					{links.map((link, index) => (
						<div key={index} className="flex gap-2">
							<input
								type="text"
								placeholder="Link title"
								value={link.title}
								onChange={e => updateLink(index, "title", e.target.value)}
								className="min-w-0 flex-1 rounded border border-dark-primary-color p-2"
							/>

							<input
								type="url"
								placeholder="https://..."
								value={link.url}
								onChange={e => updateLink(index, "url", e.target.value)}
								className="min-w-0 flex-1 rounded border border-dark-primary-color p-2"
							/>

							<button
								type="button"
								onClick={() => removeLink(index)}
								className="rounded border border-dark-primary-color px-3"
							>
								Remove
							</button>
						</div>
					))}

					<button
						type="button"
						onClick={addLink}
						className="self-start rounded border border-dark-primary-color px-4 py-2"
					>
						+ Add Link
					</button>
				</div>

				<div className="flex items-center gap-2">
					<input
						id="event-visible"
						type="checkbox"
						checked={visible}
						onChange={e => setVisible(e.target.checked)}
					/>

					<label htmlFor="event-visible">Show event</label>
				</div>
			</div>
		</Modal>
	);
};

export default EventEditor;
