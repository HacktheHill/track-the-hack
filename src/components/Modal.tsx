import { useEffect } from "react";
import { createPortal } from "react-dom";

type ButtonConfig = {
	label: string;
	onClick: () => void;
	className?: string;
};

type ModalProps = {
	children: React.ReactNode;
	buttons: ButtonConfig[];
};

const Modal = ({ children, buttons }: ModalProps) => {
	const modalRoot = document.getElementById("modal-root");

	useEffect(() => {
		if (!modalRoot) {
			const div = document.createElement("div");
			div.setAttribute("id", "modal-root");
			document.body.querySelector("_");
		}
	}, [modalRoot]);

	return modalRoot
		? createPortal(
				<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-light-tertiary-color bg-opacity-90 p-4">
					<div className="ui-panel flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto p-6 text-center">
						{children}
						<div className="flex flex-wrap justify-center gap-3">
							{buttons.map((button, index) => (
								<button
									key={index}
									type="button"
									className={`ui-button ${button.className || ""}`}
									onClick={button.onClick}
								>
									{button.label}
								</button>
							))}
						</div>
					</div>
				</div>,
				modalRoot,
			)
		: null;
};

export default Modal;
