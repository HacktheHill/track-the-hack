import type { GetStaticProps, NextPage } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import { useTranslation } from "next-i18next";

import { trpc } from "../../utils/api";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCalendar} from "@fortawesome/free-regular-svg-icons";
import '@fortawesome/fontawesome-svg-core/styles.css'
import {useState} from "react";
import {faLink, faLocationDot} from "@fortawesome/free-solid-svg-icons";
import {faInstagram, faLinkedin, faXTwitter} from "@fortawesome/free-brands-svg-icons";


export const getStaticProps: GetStaticProps = async ({ locale }) => {
    return {
        props: await serverSideTranslations(locale ?? "en", ["common", "schedule", "event"]),
    };
};

const Events: NextPage = () => {
    const { t } = useTranslation("schedule");

    const router = useRouter();
    const { locale } = router;

    const query = trpc.events.all.useQuery();
    const { data: sessionData } = useSession();
	const id = sessionData?.user?.id ?? "";

    //check if a hackerinfo exists
    const hackerInfoID = trpc.users.getHackerId.useQuery({ id });
    const hackerInfoData = trpc.hackers.get.useQuery({id : hackerInfoID.data ?? ""}, { enabled: !!id });

    // if its -1, then no modal is open. If its 0, then the first modal is open, etc.
    const [isModalOpen, setModalOpen] = useState(-1);
    const openModal = (n : number) => setModalOpen(n);
    const closeModal = () => setModalOpen(-1);
    const presenceQuery = trpc.presence.getFromHackerId.useQuery({ id: hackerInfoID.data ?? "" }, { enabled: !!id });
    const presenceMutation = trpc.presence.update.useMutation();
    
    let dateLocale = "en-CA";
    if (locale === "fr") {
        dateLocale = "fr-CA";
    }

    if (query.isLoading || query.data == null) {
        return (
            <App className="h-full bg-default-gradient px-16 py-12">
                <Loading />
            </App>
        );
    } else if (query.isError) {
        return (
            <App className="h-full bg-default-gradient px-16 py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                    <Error message={query.error.message} />
                </div>
            </App>
        );
    }

    if (query.data == null) {
        void router.push("/404");
    }

    const registerUser = () => {
        if (hackerInfoID.data) {
            console.log(hackerInfoID)
            //set the wieSignUp to true
            const updatedPresenceInfo = { ...presenceQuery.data, wieSignUp: true };
            //remove all unwanted keys from prescence
            const onlyBooleanValues = Object.entries(updatedPresenceInfo)
            .filter(([key, value]) => typeof value === "boolean")
            .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

            //update the presence
            presenceMutation.mutate({ id: hackerInfoID.data ?? "", presenceInfo: onlyBooleanValues });
            closeModal();
        }
        else {
            void router.push("events/registration");
        }
    };

    return (
        <App className="flex h-0 flex-col items-center bg-default-gradient" integrated={true} title={t("title")}>
            <div className="w-full overflow-y-auto p-4 mobile:px-0">
                <h1 className="text-3xl text-center m-3 font-bold">List of Events</h1>
                <div className="flex flex-wrap flex-col lg:items-start items-center lg:flex-row m-2 p-2 justify-center">

                    {query.data.map((event, index) => ( 
                        <div key={index} className="bg-light-quaternary-color m-2.5 justify-center items-center w-[75vh] rounded overflow-hidden group transition-all border border-transparent hover:border-solid hover:border-white hover:border-2" onClick={(e) => {openModal(index)}}>
                        <div className="relative overflow-hidden rounded-t group">
                            <img
                                src="./assets/events/wie-hack-background.png"
                                alt=""
                                className="object-cover w-full h-32"
                            />
                            <div className="absolute bottom-0 left-0 right-0 top-0 w-full overflow-hidden bg-fixed" style={{ backgroundColor: 'hsla(0, 0%, 0%, 0.6)' }}>
                                <div className="flex justify-between p-4">
                                    <div className="flex flex-col text-white">
                                        <h1 className="text-xl">{event.name}</h1>
                                        <h2 className="text-md text-gray-400">Hacker Series Event</h2>
                                        <p className="text-sm my-3">{event.room}</p>
                                    </div>
                                    <div className="flex flex-start justify-start">
                                        <FontAwesomeIcon icon={faCalendar} style={{ color: "#ffffff" }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col m-2">
                            <h4 className="text-gray-800">{event.start.toLocaleString()}</h4>
                            <p>{event.description}</p>
                        </div>
                    </div>))}
                </div>
            </div>
            <Modal isOpen={isModalOpen !== -1} onClose={closeModal}>
                <h1 className="text-2xl font-bold mb-4 text-center m-1.5 p-1.5"></h1>

                <div className="flex lg:flex-row flex-col m-2 ">
                    <div className="flex flex-col justify-center max-w-[70vh] px-1.5">
                        <h1 className="text-3xl font-bold px-1.5">{query.data[isModalOpen]?.name}</h1>
                        <div className="px-1.5">
                            <div className="flex space-x-6 lg:space-x-10 py-2 text-lg">
                                <div className="flex flex-row items-center">
                                    <FontAwesomeIcon icon={faCalendar} className="mr-2"  />
                                    <h2>{query.data[isModalOpen]?.start.toLocaleString()}</h2>
                                </div>
                                <div className="flex flex-row items-center">
                                    <FontAwesomeIcon icon={faLocationDot} className="mr-2" />
                                    <h2>{query.data[isModalOpen]?.room}</h2>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center py-4">
                                <img className="w-[60%]" src="./assets/events/wie-hack-background.png" />
                            </div>
                            <div className="text-md">
                                <p>
                                    {query.data[isModalOpen]?.description}
                                </p>
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
                    <div className="flex flex-col lg:items-center m-3">
                        {!presenceQuery.data?.wieSignUp ? (
                        <button className="bg-dark-primary-color w-full text-2xlt p-4 rounded text-white" onClick={registerUser}>Register to the event</button>
                        ) : (<button disabled className="bg-dark-primary-color grayscale-50  w-full text-2xlt p-4 rounded text-white opacity-50">You are signed up!</button>)}
                        <div className="flex flex-col text-lg py-4">
                            <h2 className="text-sm text-gray-700">FOLLOW US</h2>
                            <div className="flex flex-row space-x-5 py-4">
                                <a href="https://www.instagram.com/hackthehill/"><FontAwesomeIcon icon={faInstagram} /></a>
                                <a href="https://twitter.com/hackthehill_"><FontAwesomeIcon icon={faXTwitter} /></a>
                                <a href="https://www.linkedin.com/company/hackthehill"><FontAwesomeIcon icon={faLinkedin} /></a>
                                <a href="2024.hackthehill.com"><FontAwesomeIcon icon={faLink} /></a>
                            </div>
                            <h2 className="text-sm text-gray-700">NEED HELP ?</h2>
                            <div className="py-4">
                                <a href="mailto:development@hackthehill.com" className="border-2 border-solid border-black rounded p-3">Contact the event organiser</a>
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
    const modalClasses = isOpen
        ? 'fixed inset-0 overflow-y-auto flex items-center justify-center'
        : 'hidden';

    return (
        <div className={`modal ${modalClasses}`}>
            <div className="modal-overlay fixed inset-0 bg-black opacity-50"></div>
            <div className="modal-container relative p-4 bg-light-quaternary-color rounded shadow-lg max-h-[70vh] overflow-y-auto mt-22 mx-2.5">
                {/* Ajoutez max-h-[80vh] pour définir une hauteur maximale de 80% de la hauteur de la vue */}
                <button className="absolute top-0 right-0 p-4" onClick={onClose}>
                    <span className="text-xl">×</span>
                </button>
                {children}
            </div>
        </div>
    );
};





export default Events;