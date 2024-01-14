import type { GetStaticProps, NextPage } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import { useTranslation } from "next-i18next";

import { trpc } from "../../utils/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar } from "@fortawesome/free-regular-svg-icons";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { useEffect, useState } from "react";
import { faLink, faLocationDot } from "@fortawesome/free-solid-svg-icons";
import { faInstagram, faLinkedin, faXTwitter } from "@fortawesome/free-brands-svg-icons";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "schedule", "event"]),
	};
};

const Events: NextPage = () => {
	const { t } = useTranslation("schedule");

	const router = useRouter();
	const { locale } = router;

	const events = trpc.events.all.useQuery();
	const { data: sessionData } = useSession();
	const id = sessionData?.user?.id ?? "";

	//check if a hackerinfo exists
	const hackerInfoID = trpc.users.getHackerId.useQuery({ id });

	const signUpMutation = trpc.users.signUp.useMutation();
	const idInURL = router.query.id ?? "";
	// if its empty, then no modal is open. If its 0, then the first modal is open, etc.
	const [modalId, setModalId] = useState(idInURL as string);
    const eventsUserSignedUpTo = trpc.users.getSignedUpEvents.useQuery()

    const idsOfEventsUserSignedUpTo = eventsUserSignedUpTo?.data?.map(event => event.id);

	const openModal = (eventId: string) => {
		void router.push(`/events?eventId=${eventId}`);
		setModalId(eventId);
	};
	const closeModal = () => {
		void router.push(`/events`);
		setModalId("");
	};
	let dateLocale = "en-CA";

	if (locale === "fr") {
		dateLocale = "fr-CA";
	}

	if (events.isLoading || events.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Loading />
			</App>
		);
	} else if (events.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={events.error.message} />
				</div>
			</App>
		);
	}

	if (events.data == null) {
		void router.push("/404");
	}

	const registerUser = () => {
		if (!id) {
			void signIn();
		}

		if (hackerInfoID.data) {
			console.log(hackerInfoID);
			signUpMutation.mutate({ eventId: modalId });
			closeModal();
		} else {
			void router.push("events/registration/?eventId=" + modalId);
		}
	};

	//To make event info display in the modal, we need a way to access the event info with the event id
	const idToIndex: Record<string, number> = {};
	return (
		<App className="flex h-0 flex-col items-center bg-default-gradient" integrated={true} title={t("title")}>
			<div className="w-full overflow-y-auto p-4 mobile:px-0">
				<h1 className="m-3 text-center text-3xl font-bold">List of Events</h1>
				<div className="m-2 flex flex-col flex-wrap items-center justify-center p-2 lg:flex-row lg:items-start">
					;
					{events.data.map(
						(event, index) => (
							(idToIndex[event.id] = index),
							(
								<div
									key={event.id}
									className="group m-2.5 w-[75vh] items-center justify-center overflow-hidden rounded border border-transparent bg-light-quaternary-color transition-all hover:border-2 hover:border-solid hover:border-white"
									onClick={() => {
										openModal(event.id);
									}}
								>
									<div className="group relative overflow-hidden rounded-t">
										<img
											src="./assets/events/wie-hack-background.png"
											alt=""
											className="h-32 w-full object-cover"
										/>
										<div
											className="absolute bottom-0 left-0 right-0 top-0 w-full overflow-hidden bg-fixed"
											style={{ backgroundColor: "hsla(0, 0%, 0%, 0.6)" }}
										>
											<div className="flex justify-between p-4">
												<div className="flex flex-col text-white">
													<h1 className="text-xl">{event.name}</h1>
													<h2 className="text-md text-gray-400">Hacker Series Event</h2>
													<p className="my-3 text-sm">{event.room}</p>
												</div>
												<div className="flex-start flex justify-start">
													<FontAwesomeIcon icon={faCalendar} style={{ color: "#ffffff" }} />
												</div>
											</div>
										</div>
									</div>
									<div className="m-2 flex flex-col">
										<h4 className="text-gray-800">{event.start.toLocaleString()}</h4>
										<p>{event.description}</p>
									</div>
								</div>
							)
						),
					)}
				</div>
			</div>
			<Modal isOpen={modalId !== ""} onClose={closeModal}>
				<div className=" m-2">
					<h1 className="m-1.5 p-1.5 text-2xl font-bold">
						{events.data[idToIndex[modalId ?? ""] ?? 0]?.name}
					</h1>
					<div className="flex flex-col lg:flex-row ">
						<div className="flex max-w-[70vh] flex-col justify-center px-1.5">
							<h1 className="px-1.5 text-3xl font-bold">{}</h1>
							<div className="px-1.5">
								<div className="flex space-x-6 py-2 text-lg lg:space-x-10">
									<div className="flex flex-row items-center">
										<FontAwesomeIcon icon={faCalendar} className="mr-2" />
										<h2>{events.data[idToIndex[modalId ?? ""] ?? 0]?.start.toLocaleString()}</h2>
									</div>
									<div className="flex flex-row items-center">
										<FontAwesomeIcon icon={faLocationDot} className="mr-2" />
										<h2>{events.data[idToIndex[modalId ?? ""] ?? 0]?.room}</h2>
									</div>
								</div>
								<div className="flex flex-col justify-center py-4">
									<img className="w-[60%]" src="./assets/events/wie-hack-background.png" />
								</div>
								<div className="text-md">
									<p>{events.data[idToIndex[modalId ?? ""] ?? 0]?.description}</p>
								</div>
								{/* <div className="flex items-center py-4">
                                <div className="flex-1 border-b border-black"></div>
                                <p className="mx-4">Registration</p>
                                <div className="flex-1 border-b border-black"></div>
                            </div>

                            <div>
                                <div className="flex justify-between lg:flex-row lg:justify-normal items-center text-lg py-1.5 ">
                                    <h1 className=" self-center px-3 py-2 text-lg">Question 1</h1>
                                    <input className="/50 bg-background1 text-dark hover:bg-background2 w-[40%] lg:w-[30%] rounded-[100px] border-none px-1 py-1 font-rubik shadow-md	outline-none transition-all duration-500"/>
                                </div>
                                <div className="flex justify-between lg:flex-row lg:justify-normal items-center text-lg py-1.5 ">
                                    <h1 className=" self-center px-3 py-2 text-lg">Question 2</h1>
                                    <input className="/50 bg-background1 text-dark hover:bg-background2 w-[40%] lg:w-[30%] rounded-[100px] border-none px-1 py-1 font-rubik shadow-md	outline-none transition-all duration-500"/>
                                </div>
                                <div className="flex justify-between lg:flex-row lg:justify-normal items-center text-lg py-1.5 ">
                                    <h1 className=" self-center px-3 py-2 text-lg">Question 3</h1>
                                    <input className="/50 bg-background1 text-dark hover:bg-background2 w-[40%] lg:w-[30%] rounded-[100px] border-none px-1 py-1 font-rubik shadow-md	outline-none transition-all duration-500"/>
                                </div>
                                <div className="flex justify-between lg:flex-row lg:justify-normal items-center text-lg py-1.5 ">
                                    <h1 className=" self-center px-3 py-2 text-lg">Question 4</h1>
                                    <input className="/50 bg-background1 text-dark hover:bg-background2 w-[40%] lg:w-[30%] rounded-[100px] border-none px-1 py-1 font-rubik shadow-md	outline-none transition-all duration-500"/>
                                </div>
                                <div className="flex justify-between lg:flex-row lg:justify-normal items-center text-lg py-1.5 ">
                                    <h1 className=" self-center px-3 py-2 text-lg">Question 5</h1>
                                    <input className="/50 bg-background1 text-dark hover:bg-background2 w-[40%] lg:w-[30%] rounded-[100px] border-none px-1 py-1 font-rubik shadow-md	outline-none transition-all duration-500"/>
                                </div>
                                <div className="flex justify-between lg:flex-row lg:justify-normal items-center text-lg py-1.5 ">
                                    <h1 className=" self-center px-3 py-2 text-lg">Question 6</h1>
                                    <input className="/50 bg-background1 text-dark hover:bg-background2 w-[40%] lg:w-[30%] rounded-[100px] border-none px-1 py-1 font-rubik shadow-md	outline-none transition-all duration-500"/>
                                </div>
                                <div className="flex justify-between lg:flex-row lg:justify-normal items-center text-lg py-1.5 ">
                                    <h1 className=" self-center px-3 py-2 text-lg">Question 7</h1>
                                    <input className="/50 bg-background1 text-dark hover:bg-background2 w-[40%] lg:w-[30%] rounded-[100px] border-none px-1 py-1 font-rubik shadow-md	outline-none transition-all duration-500"/>
                                </div>
                                <div className="flex justify-between lg:flex-row lg:justify-normal items-center text-lg py-1.5 ">
                                    <h1 className=" self-center px-3 py-2 text-lg">Question 8</h1>
                                    <input className="/50 bg-background1 text-dark hover:bg-background2 w-[40%] lg:w-[30%] rounded-[100px] border-none px-1 py-1 font-rubik shadow-md	outline-none transition-all duration-500"/>
                                </div>
                            </div> */}
							</div>
						</div>
						<div className="m-3 flex flex-col lg:items-center">
							{!idsOfEventsUserSignedUpTo?.includes(modalId) ? (
								<button
									className="text-2xlt w-full rounded bg-dark-primary-color p-4 text-white"
									onClick={registerUser}
								>
									Register to the event
								</button>
							) : (
								<button
									disabled
									className="grayscale-50 text-2xlt  w-full rounded bg-dark-primary-color p-4 text-white opacity-50"
								>
									You are signed up!
								</button>
							)}
							<div className="flex flex-col py-4 text-lg">
								<h2 className="text-sm text-gray-700">FOLLOW US</h2>
								<div className="flex flex-row space-x-5 py-4">
									<a href="https://www.instagram.com/hackthehill/">
										<FontAwesomeIcon icon={faInstagram} />
									</a>
									<a href="https://twitter.com/hackthehill_">
										<FontAwesomeIcon icon={faXTwitter} />
									</a>
									<a href="https://www.linkedin.com/company/hackthehill">
										<FontAwesomeIcon icon={faLinkedin} />
									</a>
									<a href="2024.hackthehill.com">
										<FontAwesomeIcon icon={faLink} />
									</a>
								</div>
								<h2 className="text-sm text-gray-700">NEED HELP ?</h2>
								<div className="py-4">
									<a
										href="mailto:development@hackthehill.com"
										className="rounded border-2 border-solid border-black p-3"
									>
										Contact the event organiser
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</Modal>
		</App>
	);
};

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
}

const Modal = ({ isOpen, onClose, children }: ModalProps) => {
	const modalClasses = isOpen ? "fixed inset-0 overflow-y-auto flex items-center justify-center" : "hidden";

	return (
		<div className={`modal ${modalClasses}`}>
			<div className="modal-overlay fixed inset-0 bg-black opacity-50"></div>
			<div className="modal-container mt-22 relative mx-2.5 max-h-[70vh] overflow-y-auto rounded bg-light-quaternary-color p-4 shadow-lg">
				{/* Ajoutez max-h-[80vh] pour définir une hauteur maximale de 80% de la hauteur de la vue */}
				<button className="absolute right-0 top-0 p-4" onClick={onClose}>
					<span className="text-xl">×</span>
				</button>
				{children}
			</div>
		</div>
	);
};

export default Events;
