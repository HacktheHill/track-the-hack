import { Role, type Prisma } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { trpc } from "../../utils/api";

import { z } from "zod";
import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import OnlyRole from "../../components/OnlyRole";
import { walkInSchema } from "../../utils/common";

type HackerInfo = Prisma.HackerInfoGetPayload<true>;
type PresenceInfo = Prisma.PresenceInfoGetPayload<true>;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "hacker"]),
	};
};

const Hacker: NextPage = () => {
	const router = useRouter();
	const [id] = [router.query.id].flat();
	const { t } = useTranslation("hacker");

	const hackerQuery = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });
	const presenceQuery = trpc.presence.getFromHackerId.useQuery({ id: id ?? "" }, { enabled: !!id });

	if (hackerQuery.isLoading || hackerQuery.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
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
			<App className="h-full bg-default-gradient px-16 py-12">
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
			<App className="h-full bg-default-gradient px-16 py-12">
				<Loading />
			</App>
		);
	} else if (presenceQuery.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
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
		<App
			className="mx-auto h-full w-full overflow-y-auto bg-default-gradient px-4 py-12"
			title={`${hackerQuery.data.firstName} ${hackerQuery.data.lastName}`}
		>
			<div className="mx-auto flex max-w-2xl flex-col gap-4">
				<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
					<HackerView hackerData={hackerQuery.data} presenceData={presenceQuery.data} />
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>{t("not-authorized-to-view-this-page")}</OnlyRole>
			</div>
		</App>
	);
};

type HackerViewProps = {
	hackerData: HackerInfo;
	presenceData: PresenceInfo;
};

type Field = {
	label: string;
	name: string;
	default_value: string | null | undefined;
	type: string;
	category: string;
	options?: string[];
};

interface Patterns {
	[key: string]: string | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const HackerView = ({ hackerData, presenceData: { id: _, hackerInfoId, ...presenceData } }: HackerViewProps) => {
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const presenceMutation = trpc.presence.update.useMutation();
	const [presenceState, setPresenceState] = useState(presenceData);
	const [edit, setEdit] = useState(false);

	const resumeUploadRef = useRef<HTMLInputElement>(null);

	const paragraphClass = "flex justify-between gap-4 text-right py-1.5 ";
	const boldClass = "text-left font-bold";

	const keyToLabel = {
		checkedIn: "Checked In",
		breakfast1: "Breakfast March 4th",
		lunch1: "Lunch March 4th",
		dinner1: "Dinner March 4th",
		snacks: "Snacks",
		snacks2: "Snacks 2",
		redbull: "RedBull",
		breakfast2: "Breakfast March 5th",
		lunch2: "Lunch March 5th",
		lunch22: "Lunch March 5th 2",
		wieSignUp: "WIE Event Sign up February 3rd",
	} as const satisfies Record<keyof Omit<PresenceInfo, "id" | "hackerInfoId">, string>;

	const fields = [
		{
			label: "Gender",
			name: "gender",
			default_value: hackerData.gender,
			type: "text",
			category: "Personal Information",
		},
		{
			label: "First Name",
			name: "firstName",
			default_value: hackerData.firstName,
			type: "text",
			category: "Personal Information",
		},
		{
			label: "Last Name",
			name: "lastName",
			default_value: hackerData.lastName,
			type: "text",
			category: "Personal Information",
		},
		{
			label: "University",
			name: "university",
			default_value: hackerData.university,
			type: "text",
			category: "Personal Information",
		},
		{
			label: "Study Level",
			name: "studyLevel",
			default_value: hackerData.studyLevel?.toUpperCase(),
			type: "text",
			category: "Personal Information",
		},
		{
			label: "Study Program",
			name: "studyProgram",
			default_value: hackerData.studyProgram,
			type: "text",
			category: "Personal Information",
		},
		{
			label: "Graduation Year",
			name: "graduationYear",
			default_value: hackerData.graduationYear,
			type: "number",
			category: "Personal Information",
		},
		{
			label: "Phone Number",
			name: "phoneNumber",
			default_value: hackerData.phoneNumber,
			type: "tel",
			category: "Personal Information",
		},
		{
			label: "Email",
			name: "email",
			default_value: hackerData.email,
			type: "text",
			category: "Personal Information",
		},
		{
			label: "Emergency Contact Name",
			name: "emergencyContactName",
			default_value: hackerData.emergencyContactName,
			type: "text",
			category: "Emergency Contact",
		},
		{
			label: "Emergency Contact Relationship",
			name: "emergencyContactRelationship",
			default_value: hackerData.emergencyContactRelationship,
			type: "text",
			category: "Emergency Contact",
		},
		{
			label: "Emergency Contact Phone Number",
			name: "emergencyContactPhoneNumber",
			default_value: hackerData.emergencyContactPhoneNumber,
			type: "tel",
			category: "Emergency Contact",
		},
		{
			label: "Dietary Restrictions",
			name: "dietaryRestrictions",
			default_value: hackerData.dietaryRestrictions,
			type: "text",
			category: "General Information",
		},
		{
			label: "Accessibility Requirements",
			name: "accessibilityRequirements",
			default_value: hackerData.accessibilityRequirements,
			type: "text",
			category: "General Information",
		},
		{
			label: "Preferred Language",
			name: "preferredLanguage",
			default_value: hackerData.preferredLanguage,
			type: "select",
			options: ["EN", "FR"],
			category: "General Information",
		},
		{
			label: "Shirt Size",
			name: "shirtSize",
			default_value: hackerData.shirtSize,
			type: "select",
			options: ["S", "M", "L", "XL", "XXL"],
			category: "General Information",
		},
		{
			label: "Walk In",
			name: "walkIn",
			default_value: hackerData.walkIn,
			type: "text",
			category: "General Information",
		},
		{
			label: "Subscribed",
			name: "subscribed",
			default_value: hackerData.unsubscribed,
			type: "text",
			category: "General Information",
		},
		{
			label: "Attendance Type",
			name: "attendanceType",
			default_value: hackerData.attendanceType,
			type: "text",
			category: "General Information",
		},
		{
			label: "Location",
			name: "location",
			default_value: hackerData.location,
			type: "text",
			category: "General Information",
		},
		{
			label: "Transportation Required",
			name: "transportationRequired",
			default_value: hackerData.transportationRequired,
			type: "text",
			category: "General Information",
		},
		{
			label: "Linkedin",
			name: "linkLinkedin",
			default_value: hackerData.linkLinkedin,
			type: "url",
			category: "Links Information",
		},
		{
			label: "Github",
			name: "linkGithub",
			default_value: hackerData.linkGithub,
			type: "url",
			category: "Links Information",
		},
	];

	const patterns: Patterns = {
		tel: "^\\s*(?:\\+?(\\d{1,3}))?[-. (]*(\\d{3})[-. )]*(\\d{3})[-. ]*(\\d{4})(?: *x(\\d+))?\\s*$",
		url: undefined,
		number: "^\\d+$",
		email: undefined,
		text: undefined,
	};

	const initialInputValues: Record<string, string> = {};
	const { t } = useTranslation("walk-in");
	const [inputValues, setInputValues] = useState<{ [key: string]: string }>(initialInputValues);
	const groupedData: { [key: string]: Field[] } = {};
	const mutation = trpc.hackers.update.useMutation();

	const handleInputChange = (name: string, value: string) => {
		setInputValues(prevValues => ({
			...prevValues,
			[name]: value,
		}));
		setEdit(true);
	};

	const resetInputFields = () => {
		setInputValues(initialInputValues);
		setEdit(false);
	};

	fields.forEach(field => {
		initialInputValues[field.name] = String(field.default_value) || "";
	});

	fields.forEach(item => {
		const field = item as Field;
		if (!groupedData[field.category]) {
			groupedData[field.category] = [];
		}
		groupedData[field.category]?.push(field);
	});

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const data = Object.fromEntries(formData) as Record<string, string | number | undefined>;
		data.id = id;

		if (data.linkLinkedin !== hackerData.linkLinkedin || data.linkGithub !== hackerData.linkGithub) {
			window.location.reload();
		}

		if (typeof data.graduationYear === "string") {
			const parsedGraduationYear = parseInt(data.graduationYear);
			if (!isNaN(parsedGraduationYear)) {
				data.graduationYear = parsedGraduationYear;
			} else {
				data.graduationYear = undefined;
			}
		}

		const parse = walkInSchema
			.extend({
				id: z.string(),
			})
			.safeParse(data);

		if (!parse.success) {
			console.error("Validation Error:", parse.error);
		} else {
			console.log("Data parsed", parse.data);
			mutation.mutate(parse.data);
			if (!mutation.error) {
				event.currentTarget.reset();
			} else {
				console.log("Error", mutation.error.message);
			}
		}
		setEdit(false);
	};

	return (
		<>
			<h1 className="self-center font-coolvetica text-4xl font-normal text-dark-color">
				{hackerData.firstName} {hackerData.lastName} ({hackerData.gender})
			</h1>

			<p className="self-center">
				{hackerData.studyLevel?.toUpperCase()} {hackerData.studyProgram}{" "}
				{hackerData.university && `at ${hackerData.university}`}{" "}
				{hackerData.graduationYear && `(${hackerData.graduationYear})`}
			</p>
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				<div className="grid grid-flow-row grid-cols-2 gap-4 rounded-lg bg-light-tertiary-color p-4">
					{Object.entries(presenceState).map(([key, value]) => (
						<p key={key}>
							<input
								className="form-checkbox h-3.5 w-5 rounded text-gray-800 accent-dark-primary-color"
								type="checkbox"
								key={key}
								id={key}
								checked={value}
								onChange={() => {
									const updatedPresenceInfo = { ...presenceState, [key]: !value };
									setPresenceState(updatedPresenceInfo);
									presenceMutation.mutate({
										id: id ?? "",
										presenceInfo: updatedPresenceInfo,
									});
								}}
							/>{" "}
							<label htmlFor={key}>{keyToLabel[key as keyof typeof keyToLabel]}</label>
						</p>
					))}
				</div>
			</OnlyRole>

			<form onSubmit={handleSubmit}>
				{Object.keys(groupedData).map((category, index) => (
					<div key={index}>
						<div className="flex justify-center">
							<h2 className="text-dark self-center px-3 py-2 font-[Coolvetica] text-2xl font-normal">
								{category}
							</h2>
						</div>
						{groupedData[category]?.map((item, itemIndex) => (
							<div key={itemIndex} className={paragraphClass}>
								<b className={boldClass}>{item.label}</b>
								{item.type === "select" ? (
									<select
										id={item.name}
										name={item.name}
										className="col-md-6 bg-background1 text-dark hover:bg-background1/50 w-[50%] rounded-[100px] border-none px-5 py-2 font-rubik shadow-md transition-all duration-500"
										value={inputValues[item.name] ?? ""}
										onChange={e => {
											handleInputChange(item.name, e.target.value);
										}}
									>
										<option value="">{t("select")}</option>
										{item.options?.map(option => (
											<option key={option} value={option}>
												{t(option)}
											</option>
										))}
									</select>
								) : (
									<input
										id={item.name}
										name={item.name}
										type={item.type}
										className="/50 bg-background1 text-dark hover:bg-background2 w-[50%] rounded-[100px] border-none px-4 py-2 font-rubik shadow-md	outline-none transition-all duration-500"
										defaultValue={
											item.default_value !== null
												? item.default_value
												: item.type === "select"
												? ""
												: `No ${item.label}`
										}
										value={inputValues[item.name] || ""}
										onChange={e => {
											handleInputChange(item.name, e.target.value);
										}}
										pattern={patterns[item.type]}
									/>
								)}
							</div>
						))}
					</div>
				))}

				<input
					ref={resumeUploadRef}
					className="bg-background2 rounded-md border border-gray-400 p-2"
					type="file"
					accept="application/pdf"
				/>

				<p className="flex flex-row flex-wrap justify-center gap-4 py-4">
					{Object.entries({
						Resume: hackerData.linkResume,
						LinkedIn: hackerData.linkLinkedin,
						GitHub: hackerData.linkGithub,
						"Personal Website": hackerData.linkPersonalSite,
					}).map(
						([key, value]) =>
							value && (
								<a
									key={key}
									href={value}
									target="_blank"
									rel="noreferrer"
									className="flex items-center justify-center gap-2 rounded-md bg-dark-color px-4 py-2 text-white hover:bg-gray-700"
								>
									{key}
								</a>
							),
					)}
				</p>

				<OnlyRole filter={role => role === Role.ORGANIZER}>
					<>
						<div className="flex justify-center py-4">
							<h2 className="text-dark self-center py-4 font-[Coolvetica] text-2xl font-normal ">
								Debug Information
							</h2>
						</div>
						<p className={paragraphClass}>
							<b className={boldClass}>HackerInfo ID</b> {hackerData.id ?? "NULL"}
						</p>
						<p className={paragraphClass}>
							<b className={boldClass}>User ID</b> {hackerData.userId ?? "NULL"}
						</p>
						<p className={paragraphClass}>
							<b className={boldClass}>Unsubscribe Token</b> {hackerData.unsubscribeToken ?? "NULL"}
						</p>
						<p className={paragraphClass}>
							<b className={boldClass}>Acceptance Expiry</b>{" "}
							{(hackerData.acceptanceExpiry ?? "NULL").toString()}
						</p>
					</>
				</OnlyRole>

				{edit && (
					<div className="sticky bottom-0 flex justify-center">
						<div className="flex rounded-md bg-gray-800 px-2 py-2 text-white transition delay-150 ease-in-out">
							<div className="flex flex-col items-center gap-2">
								<p className="px-5 py-2">Careful - you have unsaved changes! </p>
							</div>
							<div className="flex flex-row items-center gap-2">
								<button className="px-4 py-2" onClick={resetInputFields}>
									Reset
								</button>
								<button className="h-max w-max rounded-md bg-green-500 px-4 py-2">
									<i className="fas fa-user-edit"></i> Save
								</button>
							</div>
						</div>
					</div>
				)}
			</form>
		</>
	);
};

export default Hacker;
