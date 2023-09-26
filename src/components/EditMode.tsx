import {useState} from "react";
import {filter} from "minimatch";

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



const EditMode = ({ hackerData }: EditModeProps) => {

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

    const paragraphClass = "flex justify-between gap-4 text-right ";
    const boldClass = "text-left font-bold";


    const fields = [
        {
            initial_value: hackerData.gender,
            value: gender,
            stateSetter: setGender,
            label: 'Gender',
        },
        {
            initial_value: hackerData.firstName,
            value: firstName,
            stateSetter: setFirstName,
            label: 'First Name',
        },
        {
            initial_value: hackerData.lastName,
            value: lastName,
            stateSetter: setLastName,
            label: 'Last Name',
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


    return (
        <>
            <div className="">
                {fields.map((field) => (
                    <div className="py-3" key={field.label}>
                        <p className={paragraphClass} key={field.label}>
                            <b className={boldClass}> {field.label} </b>
                            <input
                                className="rounded px-4 py-2 bg-gray-800 w-64 text-white outline-none"
                                onChange={(e) => {
                                    field.stateSetter(e.target.value);
                                }}
                                type="text"
                                value={field.value}
                            />
                        </p>
                    </div>
                ))}
            </div>
        </>
    );
};

export default EditMode;
