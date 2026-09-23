import { useTranslation } from "next-i18next";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ScheduleEventDetails from "./ScheduleEventDetails";

export default function ScheduleEventDialog({ id, onClose }: { id: string; onClose: () => void }) {
	const { t } = useTranslation("event");
	const ref = useRef<HTMLDialogElement>(null);
	const [root, setRoot] = useState<HTMLElement | null>(null);
	useEffect(() => setRoot(document.getElementById("modal-root")), []);
	useEffect(() => {
		if (!root) return;
		const dialog = ref.current;
		if (!dialog) return;
		dialog.showModal();
		return () => dialog.close();
	}, [root]);
	if (!root) return null;
	return createPortal(
		<dialog
			ref={ref}
			className="schedule-dialog"
			aria-label={t("title")}
			onCancel={event => {
				event.preventDefault();
				onClose();
			}}
			onClick={event => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<ScheduleEventDetails key={id} id={id} onClose={onClose} />
		</dialog>,
		root,
	);
}
