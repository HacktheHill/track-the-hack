import type { GetStaticProps, NextPage } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
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

    const [isModalOpen, setModalOpen] = useState(false);

    const openModal = () => setModalOpen(true);
    const closeModal = () => setModalOpen(false);

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


    return (
        <App className="flex h-0 flex-col items-center bg-default-gradient" integrated={true} title={t("title")}>
            <div className="w-full overflow-y-auto p-4 mobile:px-0">
                <h1 className="text-3xl text-center m-3 font-bold">List of Events</h1>
                <div className="flex flex-wrap flex-col lg:items-start items-center lg:flex-row m-2 p-2 justify-center">
                    <div className="bg-light-quaternary-color m-2.5 justify-center items-center w-[35vh] rounded overflow-hidden group transition-all border border-transparent hover:border-solid hover:border-white hover:border-2" onClick={openModal}>
                        <div className="relative overflow-hidden rounded-t group">
                            <img
                                src="https://media.wired.com/photos/5955c3573ff99d6b3a1d165c/master/pass/books.jpg"
                                alt="Books"
                                className="object-cover w-full h-32"
                            />
                            <div className="absolute bottom-0 left-0 right-0 top-0 w-full overflow-hidden bg-fixed" style={{ backgroundColor: 'hsla(0, 0%, 0%, 0.6)' }}>
                                <div className="flex justify-between p-4">
                                    <div className="flex flex-col text-white">
                                        <h1 className="text-xl">Title</h1>
                                        <h2 className="text-md text-gray-400">Category</h2>
                                        <p className="text-sm my-3">Location</p>
                                    </div>
                                    <div className="flex flex-start justify-start">
                                        <FontAwesomeIcon icon={faCalendar} style={{ color: "#ffffff" }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col m-2">
                            <h4 className="text-gray-800">Date</h4>
                            <p>These are the informations about the event, I hope youre going to enjoy this cool event.</p>
                            <p>Short description</p>
                        </div>
                    </div>
                    <div className="bg-light-quaternary-color m-2.5 justify-center items-center w-[35vh] rounded overflow-hidden group transition-all border border-transparent hover:border-solid hover:border-white hover:border-2" onClick={openModal}>
                        <div className="relative overflow-hidden rounded-t group">
                            <img
                                src="https://media.wired.com/photos/5955c3573ff99d6b3a1d165c/master/pass/books.jpg"
                                alt="Books"
                                className="object-cover w-full h-32"
                            />
                            <div className="absolute bottom-0 left-0 right-0 top-0 w-full overflow-hidden bg-fixed" style={{ backgroundColor: 'hsla(0, 0%, 0%, 0.6)' }}>
                                <div className="flex justify-between p-4">
                                    <div className="flex flex-col text-white">
                                        <h1 className="text-xl">Title</h1>
                                        <h2 className="text-md text-gray-400">Category</h2>
                                        <p className="text-sm my-3">Location</p>
                                    </div>
                                    <div className="flex flex-start justify-start">
                                        <FontAwesomeIcon icon={faCalendar} style={{ color: "#ffffff" }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col m-2">
                            <h4 className="text-gray-800">Date</h4>
                            <p>These are the informations about the event, I hope youre going to enjoy this cool event.</p>
                            <p>Short description</p>
                        </div>
                    </div>
                    <div className="bg-light-quaternary-color m-2.5 justify-center items-center w-[35vh] rounded overflow-hidden group transition-all border border-transparent hover:border-solid hover:border-white hover:border-2" onClick={openModal}>
                        <div className="relative overflow-hidden rounded-t group">
                            <img
                                src="https://media.wired.com/photos/5955c3573ff99d6b3a1d165c/master/pass/books.jpg"
                                alt="Books"
                                className="object-cover w-full h-32"
                            />
                            <div className="absolute bottom-0 left-0 right-0 top-0 w-full overflow-hidden bg-fixed" style={{ backgroundColor: 'hsla(0, 0%, 0%, 0.6)' }}>
                                <div className="flex justify-between p-4">
                                    <div className="flex flex-col text-white">
                                        <h1 className="text-xl">Title</h1>
                                        <h2 className="text-md text-gray-400">Category</h2>
                                        <p className="text-sm my-3">Location</p>
                                    </div>
                                    <div className="flex flex-start justify-start">
                                        <FontAwesomeIcon icon={faCalendar} style={{ color: "#ffffff" }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col m-2">
                            <h4 className="text-gray-800">Date</h4>
                            <p>These are the informations about the event, I hope youre going to enjoy this cool event.</p>
                            <p>Short description</p>
                        </div>
                    </div>
                    <div className="bg-light-quaternary-color m-2.5 justify-center items-center w-[35vh] rounded overflow-hidden group transition-all border border-transparent hover:border-solid hover:border-white hover:border-2" onClick={openModal}>
                        <div className="relative overflow-hidden rounded-t group">
                            <img
                                src="https://media.wired.com/photos/5955c3573ff99d6b3a1d165c/master/pass/books.jpg"
                                alt="Books"
                                className="object-cover w-full h-32"
                            />
                            <div className="absolute bottom-0 left-0 right-0 top-0 w-full overflow-hidden bg-fixed" style={{ backgroundColor: 'hsla(0, 0%, 0%, 0.6)' }}>
                                <div className="flex justify-between p-4">
                                    <div className="flex flex-col text-white">
                                        <h1 className="text-xl">Title</h1>
                                        <h2 className="text-md text-gray-400">Category</h2>
                                        <p className="text-sm my-3">Location</p>
                                    </div>
                                    <div className="flex flex-start justify-start">
                                        <FontAwesomeIcon icon={faCalendar} style={{ color: "#ffffff" }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col m-2">
                            <h4 className="text-gray-800">Date</h4>
                            <p>These are the informations about the event, I hope youre going to enjoy this cool event.</p>
                            <p>Short description</p>
                        </div>
                    </div>
                    <div className="bg-light-quaternary-color m-2.5 justify-center items-center w-[35vh] rounded overflow-hidden group transition-all border border-transparent hover:border-solid hover:border-white hover:border-2" onClick={openModal}>
                        <div className="relative overflow-hidden rounded-t group">
                            <img
                                src="https://media.wired.com/photos/5955c3573ff99d6b3a1d165c/master/pass/books.jpg"
                                alt="Books"
                                className="object-cover w-full h-32"
                            />
                            <div className="absolute bottom-0 left-0 right-0 top-0 w-full overflow-hidden bg-fixed" style={{ backgroundColor: 'hsla(0, 0%, 0%, 0.6)' }}>
                                <div className="flex justify-between p-4">
                                    <div className="flex flex-col text-white">
                                        <h1 className="text-xl">Title</h1>
                                        <h2 className="text-md text-gray-400">Category</h2>
                                        <p className="text-sm my-3">Location</p>
                                    </div>
                                    <div className="flex flex-start justify-start">
                                        <FontAwesomeIcon icon={faCalendar} style={{ color: "#ffffff" }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col m-2">
                            <h4 className="text-gray-800">Date</h4>
                            <p>These are the informations about the event, I hope youre going to enjoy this cool event.</p>
                            <p>Short description</p>
                        </div>
                    </div>




                </div>
            </div>
            <Modal isOpen={isModalOpen} onClose={closeModal}>
                <h1 className="text-2xl font-bold mb-4 text-center m-1.5 p-1.5"></h1>

                <div className="flex lg:flex-row flex-col m-2 ">
                    <div className="flex flex-col justify-center max-w-[70vh] px-1.5">
                        <h1 className="text-3xl font-bold px-1.5">Father Christmas Grotto at Enys House</h1>
                        <div className="px-1.5">
                            <div className="flex space-x-6 lg:space-x-10 py-2 text-lg">
                                <div className="flex flex-row items-center">
                                    <FontAwesomeIcon icon={faCalendar} className="mr-2"  />
                                    <h2>12/14/2034 - 3:50pm</h2>
                                </div>
                                <div className="flex flex-row items-center">
                                    <FontAwesomeIcon icon={faLocationDot} className="mr-2" />
                                    <h2>uOttawa</h2>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center py-4">
                                <img className="w-[60%]" src="https://media.wired.com/photos/5955c3573ff99d6b3a1d165c/master/pass/books.jpg" />
                            </div>
                            <div className="text-md">
                                <p>
                                    Enys House welcomes you and your family to meet Father Christmas and his enchanted woodland helpers for a magical festive storytelling experience.

                                    Enys House is transformed into a magical enchanted wonderland filled with festive cheer, family activities and a very special storytelling with Father Christmas himself. Suitable for all ages , a traditional heartfelt Christmas experience for all to enjoy.
                                </p>
                            </div>
                            <div className="flex items-center py-4">
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
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col lg:items-center m-3">
                        <button className="bg-dark-primary-color w-full text-2xlt p-4 rounded text-white">Register to the event</button>
                        <div className="flex flex-col text-lg py-4">
                            <h2 className="text-sm text-gray-700">SHARE THIS EVENT</h2>
                            <div className="flex flex-row space-x-5 py-4">
                                <FontAwesomeIcon icon={faInstagram} />
                                <FontAwesomeIcon icon={faXTwitter} />
                                <FontAwesomeIcon icon={faLinkedin} />
                                <FontAwesomeIcon icon={faLink} />
                            </div>
                            <h2 className="text-sm text-gray-700">NEED HELP ?</h2>
                            <div className="py-2">
                                <button className="border-2 border-solid border-black rounded p-3">Contact the event organiser</button>
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