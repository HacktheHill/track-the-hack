import { useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { EventType, ScannerWorkflow, type Event } from "@prisma/client";
import { trpc } from "@/server/api/api";
import { useTranslation } from "next-i18next";

type EventEditorProps = {
	event: Pick<
		Event,
		| "id"
		| "name"
		| "nameFr"
		| "room"
		| "description"
		| "descriptionFr"
		| "start"
		| "end"
		| "hidden"
		| "type"
		| "scannerWorkflow"
		| "maxCheckIns"
		| "host"
		| "image"
		| "link"
		| "linkText"
		| "linkTextFr"
	> | null;
	onClose: () => void;
};

type EventLink = {
	title: string;
	titleFr: string;
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

const eventTypes = [EventType.ALL, EventType.WORKSHOP, EventType.SOCIAL, EventType.CAREER_FAIR, EventType.FOOD];
const scannerWorkflows = [
	ScannerWorkflow.ATTENDANCE,
	ScannerWorkflow.CHECK_IN,
	ScannerWorkflow.MERCHANDISE,
	ScannerWorkflow.FOOD,
];

const EventEditor = ({ event, onClose }: EventEditorProps) => {
	const [name, setName] = useState(event?.name ?? "");
	const [nameFr, setNameFr] = useState(event?.nameFr ?? "");
	const [room, setRoom] = useState(event?.room ?? "");
	const [description, setDescription] = useState(event?.description ?? "");
	const [descriptionFr, setDescriptionFr] = useState(event?.descriptionFr ?? "");
	const [start, setStart] = useState(event?.start ? formatDateTimeLocal(event.start) : "");
	const [end, setEnd] = useState(event?.end ? formatDateTimeLocal(event.end) : "");
	const [visible, setVisible] = useState(event ? !event.hidden : false);
	const [type, setType] = useState(event?.type ?? EventType.ALL);
	const [scannerWorkflow, setScannerWorkflow] = useState(event?.scannerWorkflow ?? ScannerWorkflow.ATTENDANCE);
	const [maxCheckIns, setMaxCheckIns] = useState(event?.maxCheckIns?.toString() ?? "");
	const [host, setHost] = useState(event?.host ?? "");
	const [links, setLinks] = useState<EventLink[]>(
		event?.link ? [{ title: event.linkText ?? "", titleFr: event.linkTextFr ?? "", url: event.link }] : [],
	);
	const [error, setError] = useState<string | null>(null);
	const saveInFlight = useRef(false);
	const { t } = useTranslation("internal");

	const utils = trpc.useUtils();

	const createEvent = trpc.events.create.useMutation({
		onSuccess: async () => {
			await Promise.all([utils.events.manage.invalidate(), utils.events.all.invalidate()]);
			onClose();
		},
		onError: error => {
			setError(error.message);
		},
		onSettled: () => {
			saveInFlight.current = false;
		},
	});

	const updateEvent = trpc.events.update.useMutation({
		onSuccess: async () => {
			await Promise.all([
				utils.events.manage.invalidate(),
				utils.events.all.invalidate(),
				...(event ? [utils.events.get.invalidate({ id: event.id })] : []),
			]);
			onClose();
		},
		onError: error => {
			setError(error.message);
		},
		onSettled: () => {
			saveInFlight.current = false;
		},
	});
	const isSaving = createEvent.isLoading || updateEvent.isLoading;

	const addLink = () => {
		if (links.length === 0) setLinks([{ title: "", titleFr: "", url: "" }]);
	};

	const handleSave = (submitEvent?: FormEvent<HTMLFormElement>) => {
		submitEvent?.preventDefault();
		if (saveInFlight.current || isSaving) return;

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

		if (!description.trim() || !descriptionFr.trim()) {
			setError(t("events.description-required"));
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

		if (maxCheckIns && (!/^\d+$/.test(maxCheckIns) || Number(maxCheckIns) > 2_147_483_647)) {
			setError(t("events.max-check-ins-invalid"));
			return;
		}

		const invalidLink = links.some(
			link =>
				(link.url.trim() && (!link.title.trim() || !link.titleFr.trim())) ||
				(!link.url.trim() && (link.title.trim() || link.titleFr.trim())),
		);

		if (invalidLink) {
			setError(t("events.link-title-url-required"));
			return;
		}

		const linkUrl = links[0]?.url.trim();
		if (linkUrl) {
			try {
				if (new URL(linkUrl).protocol !== "https:") throw new globalThis.Error();
			} catch {
				setError(t("events.link-https-required"));
				return;
			}
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
			type,
			scannerWorkflow,
			maxCheckIns: maxCheckIns === "" ? null : Number(maxCheckIns),
			host: host.trim() || null,
			link: firstLink?.url.trim() || null,
			linkText: firstLink?.title.trim() || null,
			linkTextFr: firstLink?.titleFr.trim() || null,
		};

		saveInFlight.current = true;
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

	const modalRoot = document.getElementById("modal-root");

	if (!modalRoot) {
		return null;
	}

	const errorAttributes = {
		"aria-describedby": error ? "event-editor-error" : undefined,
		"aria-invalid": error ? true : undefined,
	} as const;

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-light-tertiary-color bg-opacity-90 p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="event-editor-title"
				className="ui-panel max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto bg-light-quaternary-color p-4 text-center sm:p-8"
			>
				<h2 id="event-editor-title" className="ui-page-title mb-4">
					{event ? t("events.edit") : t("events.new")}
				</h2>

				{error && (
					<p
						id="event-editor-error"
						role="alert"
						className="ui-field-error-message mb-4 rounded border border-red-500 p-2 text-left"
					>
						{error}
					</p>
				)}

				<form
					onSubmit={handleSave}
					aria-describedby={error ? "event-editor-error" : undefined}
					className="flex flex-col gap-4 text-left"
				>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-1 flex-col gap-1">
							<label htmlFor="event-name">{t("events.name-en")}</label>

							<input
								id="event-name"
								type="text"
								maxLength={191}
								required
								value={name}
								onChange={e => setName(e.target.value)}
								className="ui-field"
								{...errorAttributes}
							/>
						</div>

						<div className="flex flex-1 flex-col gap-1">
							<label htmlFor="event-name-fr">{t("events.name-fr")}</label>

							<input
								id="event-name-fr"
								type="text"
								maxLength={191}
								required
								value={nameFr}
								onChange={e => setNameFr(e.target.value)}
								className="ui-field"
								{...errorAttributes}
							/>
						</div>
					</div>
					<div className="flex flex-col gap-1">
						<label htmlFor="event-room">{t("events.location")}</label>

						<input
							id="event-room"
							type="text"
							maxLength={191}
							required
							value={room}
							onChange={e => setRoom(e.target.value)}
							className="ui-field"
							{...errorAttributes}
						/>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-1 flex-col gap-1">
							<label htmlFor="event-start">{t("events.start")}</label>

							<input
								id="event-start"
								type="datetime-local"
								required
								value={start}
								onChange={e => setStart(e.target.value)}
								className="ui-field"
								{...errorAttributes}
							/>
						</div>

						<div className="flex flex-1 flex-col gap-1">
							<label htmlFor="event-end">{t("events.end")}</label>

							<input
								id="event-end"
								type="datetime-local"
								required
								value={end}
								onChange={e => setEnd(e.target.value)}
								className="ui-field"
								{...errorAttributes}
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-1 flex-col gap-1">
							<label htmlFor="event-description">{t("events.description-en")}</label>

							<textarea
								id="event-description"
								value={description}
								maxLength={65_535}
								required
								onChange={e => setDescription(e.target.value)}
								rows={4}
								className="ui-field"
								{...errorAttributes}
							/>
						</div>

						<div className="flex flex-1 flex-col gap-1">
							<label htmlFor="event-description-fr">{t("events.description-fr")}</label>

							<textarea
								id="event-description-fr"
								value={descriptionFr}
								maxLength={65_535}
								required
								onChange={e => setDescriptionFr(e.target.value)}
								rows={4}
								className="ui-field"
								{...errorAttributes}
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-1">
							<label htmlFor="event-type">{t("events.type")}</label>
							<select
								id="event-type"
								value={type}
								onChange={e =>
									setType(eventTypes.find(value => value === e.target.value) ?? EventType.ALL)
								}
								className="ui-field"
								{...errorAttributes}
							>
								{eventTypes.map(value => (
									<option key={value} value={value}>
										{t(`events.type-values.${value}`)}
									</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label htmlFor="event-host">{t("events.host")}</label>
							<input
								id="event-host"
								type="text"
								maxLength={191}
								value={host}
								onChange={e => setHost(e.target.value)}
								className="ui-field"
								{...errorAttributes}
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-1">
							<label htmlFor="event-scanner-workflow">{t("events.scanner-workflow")}</label>
							<select
								id="event-scanner-workflow"
								value={scannerWorkflow}
								onChange={e =>
									setScannerWorkflow(
										scannerWorkflows.find(value => value === e.target.value) ??
											ScannerWorkflow.ATTENDANCE,
									)
								}
								className="ui-field"
								{...errorAttributes}
							>
								{scannerWorkflows.map(value => (
									<option key={value} value={value}>
										{t(`events.scanner-workflow-values.${value}`)}
									</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label htmlFor="event-max-check-ins">{t("events.max-check-ins")}</label>
							<input
								id="event-max-check-ins"
								type="number"
								min={0}
								max={2_147_483_647}
								step={1}
								value={maxCheckIns}
								onChange={e => setMaxCheckIns(e.target.value)}
								className="ui-field"
								{...errorAttributes}
							/>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<span>{t("events.photo")}</span>
						{event?.image && (
							// Existing event photos may use hosts outside Next.js's configured image allowlist.
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={event.image}
								alt={t("events.photo")}
								className="max-h-48 w-full rounded object-cover"
							/>
						)}
						<p className="text-sm">{t("events.photo-read-only")}</p>
					</div>

					<div className="flex flex-col gap-2">
						<span>{t("events.links")}</span>

						{links.map((link, index) => (
							<div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<input
									aria-label={t("events.link-title")}
									type="text"
									maxLength={191}
									placeholder={t("events.link-title")}
									value={link.title}
									onChange={e => updateLink(index, "title", e.target.value)}
									className="ui-field"
									{...errorAttributes}
								/>

								<input
									aria-label={t("events.link-title-fr")}
									type="text"
									maxLength={191}
									placeholder={t("events.link-title-fr")}
									value={link.titleFr}
									onChange={e => updateLink(index, "titleFr", e.target.value)}
									className="ui-field"
									{...errorAttributes}
								/>

								<input
									aria-label={t("events.link-url")}
									type="url"
									maxLength={191}
									pattern="https://.*"
									placeholder={t("events.link-url")}
									value={link.url}
									onChange={e => updateLink(index, "url", e.target.value)}
									className="ui-field"
									{...errorAttributes}
								/>

								<button
									type="button"
									onClick={() => removeLink(index)}
									className="ui-button sm:col-span-2 sm:justify-self-start"
								>
									{t("events.remove")}
								</button>
							</div>
						))}
						{links.length === 0 && (
							<button type="button" onClick={addLink} className="ui-button self-start">
								+ {t("events.add-link")}
							</button>
						)}
					</div>

					<div className="flex items-center gap-2">
						<input
							id="event-visible"
							type="checkbox"
							checked={visible}
							onChange={e => setVisible(e.target.checked)}
							className="ui-checkbox"
						/>

						<label htmlFor="event-visible">{t("events.show")}</label>
					</div>
					<div className="flex flex-col-reverse justify-center gap-3 pt-2 sm:flex-row">
						<button
							type="button"
							className="ui-button"
							onClick={() => {
								if (!saveInFlight.current) onClose();
							}}
							disabled={isSaving}
						>
							{t("events.cancel")}
						</button>

						<button
							type="submit"
							className="ui-button ui-button-primary"
							disabled={isSaving}
							aria-busy={isSaving}
						>
							{t("events.save")}
						</button>
					</div>
				</form>
			</div>
		</div>,
		modalRoot,
	);
};

export default EventEditor;
