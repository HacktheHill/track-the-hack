import {Prisma, Role} from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps, NextPage } from "next/types";
import { useState } from "react";

import App from "../../components/App";

import { trpc } from "../../utils/api";
import {useRouter} from "next/router";
import Loading from "../../components/Loading";
import Error from "../../components/Error";
import OnlyRole from "../../components/OnlyRole";
import Link from "next/link";

type HackerInfo = Prisma.HackerInfoGetPayload<true>;
type PresenceInfo = Prisma.PresenceInfoGetPayload<true>;

type EditModeProps = {
    hackerData: {
        gender: string;
        firstName: string;
        lastName: string;
        university: string | null | undefined;
        studyLevel: string | null | undefined;
        studyProgram: string | null | undefined;
        graduationYear: number | null | undefined;
        emergencyContactName: string | null | undefined;
        emergencyContactRelationship: string | null | undefined;
        emergencyContactPhoneNumber: string | null | undefined;
        email: string | null | undefined;
        phoneNumber: string | null | undefined;
        dietaryRestrictions: string | null | undefined;
        accessibilityRequirements: string | null | undefined;
        preferredLanguage: string | null | undefined;
        shirtSize: string | null | undefined;
        confirmed: boolean | null | undefined;
        walkIn: boolean | null | undefined;
        unsubscribed: boolean | null | undefined;
        attendanceType: string | null | undefined;
        location: string | null | undefined;
        transportationRequired: boolean | null | undefined;
    };
};
export const getStaticProps: GetStaticProps = async ({ locale }) => {
    return {
        props: await serverSideTranslations(locale ?? "en", ["common", "walk-in"]),
    };
};

const Edit: NextPage = () => {

    const router = useRouter();
    const { t } = useTranslation("schedule");
    const [id] = [router.query.id].flat();
    const { locale } = router;

    const hackerQuery = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });
    const presenceQuery = trpc.presence.getFromHackerId.useQuery({ id: id ?? "" }, { enabled: !!id });

    const { data: sessionData } = useSession();


    const query = trpc.events.all.useQuery();

    let dateLocale = "en-CA";
    if (locale === "fr") {
        dateLocale = "fr-CA";
    }

    if (hackerQuery.isLoading || hackerQuery.data == null) {
        return (
            <App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
                <OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
                    <Loading />
                </OnlyRole>
                <OnlyRole filter={role => role === Role.HACKER}>
                    <div className="flex flex-col items-center justify-center gap-4">
                        <Error message="You are not allowed to view this page" />
                    </div>
                </OnlyRole>
            </App>
        );
    } else if (hackerQuery.isError) {
        return (
            <App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                    <Error message={hackerQuery.error.message} />
                </div>
            </App>
        );
    }

    if (hackerQuery.data == null) {
        void router.push("/404");
    }

    if (presenceQuery.isLoading || presenceQuery.data == null) {
        return (
            <App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
                <Loading />
            </App>
        );
    } else if (presenceQuery.isError) {
        return (
            <App className="h-full bg-gradient-to-b from-background2 to-background1 px-16 py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                    <Error message={presenceQuery.error.message} />
                </div>
            </App>
        );
    }

    if (presenceQuery.data == null) {
        void router.push("/404");
    }

    return (
        <App className="overflow-y-auto bg-gradient3 p-8 sm:p-12" title={t("title")}>
            <OnlyRole filter={role => role === Role.HACKER || role === Role.ORGANIZER}>
                <HackerInfos hackerData={hackerQuery.data} presenceData={presenceQuery.data} />
            </OnlyRole>
            {!sessionData?.user && (
                <div className="flex flex-col items-center justify-center gap-4">
                    <Error message={t("not-authorized-to-view-this-page")} />
                </div>
            )}
        </App>
    );
};

type HackerViewProps = {
    hackerData: HackerInfo;
    presenceData: PresenceInfo;
};


const HackerInfos = ({ hackerData, presenceData: { id: _, hackerInfoId, ...presenceData } }: HackerViewProps) => {
    const router = useRouter();
    const [id] = [router.query.id].flat();

    const presenceMutation = trpc.presence.update.useMutation();
    const [presenceState, setPresenceState] = useState(presenceData);

    const paragraphClass = "flex justify-between gap-4 text-right";
    const boldClass = "text-left font-bold";

    const [gender, setGender] = useState(hackerData.gender)
    const [firstName, setFirstName] = useState(hackerData.firstName);
    const [lastName, setLastName] = useState(hackerData.lastName);
    const [university, setUniversity] = useState(hackerData.university);
    const [studyLevel, setStudyLevel] = useState(hackerData.studyLevel);
    const [studyProgram, setStudyProgram] = useState(hackerData.studyProgram);
    const [graduationYear, setGraduationYear] = useState(hackerData.graduationYear);

    const [emergencyContactName, setEmergencyContactName] = useState(hackerData.emergencyContactName);
    const [emergencyContactRelationship, setEmergencyContactRelationship] = useState(hackerData.emergencyContactRelationship);
    const [emergencyContactPhoneNumber, setEmergencyContactPhoneNumber] = useState(hackerData.emergencyContactPhoneNumber);

    const [email, setEmail] = useState(hackerData.email);
    const [phone, setPhone] = useState(hackerData.phoneNumber);
    const [dietaryRestrictions, setDietaryRestrictions] = useState(hackerData.dietaryRestrictions);
    const [accessibilityRequirements, setAccessibilityRequirements] = useState(hackerData.accessibilityRequirements);
    const [preferredLanguage, setPreferredLanguage] = useState(hackerData.preferredLanguage);
    const [shirtSize, setShirtSize] = useState(hackerData.shirtSize);
    const [confirmed, setConfirmed] = useState(hackerData.confirmed);
    const [walkIn, setWalkIn] = useState(hackerData.walkIn);
    const [unsubscribed, setUnsubscribed] = useState(hackerData.unsubscribed);
    const [attendanceType, setAttendanceType] = useState(hackerData.attendanceType);
    const [location, setLocation] = useState(hackerData.location);
    const [transportationRequired, setTransportationRequired] = useState(hackerData.transportationRequired);

    const [showUnsavedChanges, setShowUnsavedChanges] = useState(false);


    const fields = [
        {
            initial_value: hackerData.gender,
            value: gender,
            stateSetter: setGender,
            label: 'gender',
        },
        {
            initial_value: hackerData.firstName,
            value: firstName,
            stateSetter: setFirstName,
            label: 'firstName',
        },
        {
            initial_value: hackerData.lastName,
            value: lastName,
            stateSetter: setLastName,
            label: 'lastName',
        },
        {
            initial_value: hackerData.university,
            value: university,
            stateSetter: setUniversity,
            label: 'University',
        },
        {
            initial_value: hackerData.studyLevel,
            value: studyLevel,
            stateSetter: setStudyLevel,
            label: 'Study Level',
        },
        {
            initial_value: hackerData.studyProgram,
            value: studyProgram,
            stateSetter: setStudyProgram,
            label: 'Study Program',
        },
        {
            initial_value: hackerData.graduationYear,
            value: graduationYear,
            stateSetter: setGraduationYear,
            label: 'Graduation Year',
        },
        {
            initial_value: hackerData.emergencyContactName,
            value: emergencyContactName,
            stateSetter: setEmergencyContactName,
            label: 'Emergency Contact Name',
        },
        {
            initial_value: hackerData.emergencyContactRelationship,
            value: emergencyContactRelationship,
            stateSetter: setEmergencyContactRelationship,
            label: 'Emergency Contact Relationship',
        },
        {
            initial_value: hackerData.emergencyContactPhoneNumber,
            value: emergencyContactPhoneNumber,
            stateSetter: setEmergencyContactPhoneNumber,
            label: 'Emergency Contact Phone Number',
        },
        {
            initial_value: hackerData.email,
            value: email,
            stateSetter: setEmail,
            label: 'Email Address',
        },
        {
            initial_value: hackerData.phoneNumber,
            value: phone,
            stateSetter: setPhone,
            label: 'Phone Number',
        },
        {
            initial_value: hackerData.dietaryRestrictions,
            value: dietaryRestrictions,
            stateSetter: setDietaryRestrictions,
            label: 'Dietary Restrictions',
        },
        {
            initial_value: hackerData.accessibilityRequirements,
            value: accessibilityRequirements,
            stateSetter: setAccessibilityRequirements,
            label: 'Accessibility Requirements',
        },
        {
            initial_value: hackerData.preferredLanguage,
            value: preferredLanguage,
            stateSetter: setPreferredLanguage,
            label: 'Preferred Language',
        },
        {
            initial_value: hackerData.shirtSize,
            value: shirtSize,
            stateSetter: setShirtSize,
            label: 'Shirt Size',
        },
        {
            initial_value: hackerData.confirmed,
            value: confirmed,
            stateSetter: setConfirmed,
            label: 'Confirmed',
        },
        {
            initial_value: hackerData.walkIn,
            value: walkIn,
            stateSetter: setWalkIn,
            label: 'Walk In',
        },
        {
            initial_value: hackerData.unsubscribed,
            value: unsubscribed,
            stateSetter: setUnsubscribed,
            label: 'Unsubscribed',
        },
        {
            initial_value: hackerData.attendanceType,
            value: attendanceType,
            stateSetter: setAttendanceType,
            label: 'Attendance Type',
        },
        {
            initial_value: hackerData.location,
            value: location,
            stateSetter: setLocation,
            label: 'Location',
        },
        {
            initial_value: hackerData.transportationRequired,
            value: transportationRequired,
            stateSetter: setTransportationRequired,
            label: 'Transportation Required',
        },
    ];
    const userMutation = trpc.edit.updateHackerInfo.useMutation()

    return (
        <>
            <div className="flex justify-center ">
                <h2 className="self-center font-[Coolvetica] text-2xl font-normal text-dark px-3 py">Editable Hacker Information </h2>
                <Link href={`/hackers/hacker?id=${hackerData.id}`}>
                    <button className="px-3 py-1 bg-gray-800 rounded text-white ">
                        Profile
                    </button>
                </Link>
            </div>
            {fields.map((field) => (
                <div className="py-2" key={field.label}>
                    <p className={paragraphClass} key={field.label}>
                        <b className={boldClass}> {field.label} </b>
                        <input
                            className="rounded px-4 py-2 bg-gray-800 w-full sm:w-64 text-white outline-none"
                            onChange={(e) => {
                                field.stateSetter(e.target.value)
                                setShowUnsavedChanges(e.target.value !== field.initial_value);
                                userMutation.mutate({
                                    id: hackerData.id,
                                    hackerInfo: {
                                        [field.label]: e.target.value
                                    }
                                })
                            }}
                            type="text"
                            value={field.value}
                            defaultValue={field.initial_value}
                        />
                    </p>
                </div>
            ))}

            {showUnsavedChanges && (
                <div className="sticky bottom-0 flex justify-center">
                    <div className="flex bg-gray-800 text-white px-2 py-2 rounded-md transition ease-in-out delay-150">
                        <p className="px-5 py-2">Careful - you have unsaved changes! </p>
                        <Link href={`/hackers/hacker?id=${hackerData.id}`}>
                            <button className="px-4 py-2">
                                Reset
                            </button>
                        </Link>
                        <button className="py-2 px-4 bg-green-500 rounded-md h-max w-max">
                            <i className='fas fa-user-edit'></i> Save
                        </button>
                    </div>
                </div>
            )}


        </>
    );
};



export default Edit;
