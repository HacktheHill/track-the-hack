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
			document.body.querySelector("_")
		}
	}, [modalRoot]);

	return modalRoot
		? createPortal(
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-light-tertiary-color bg-opacity-90">
					<div className="flex w-full max-w-lg flex-col gap-4 rounded border border-dark-primary-color bg-medium-primary-color p-8 text-center">
						{children}
						<div className="flex justify-center gap-4">
							{buttons.map((button, index) => (
								<button
									key={index}
									className={`whitespace-nowrap rounded-lg border border-dark-primary-color px-4 py-2 text-light-color transition-colors hover:bg-light-tertiary-color ${
										button.className || ""
									}`}
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
