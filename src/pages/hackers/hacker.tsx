import {Prisma } from "@prisma/client";
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
import {Role, walkInSchema } from "../../utils/common";
import type { Hacker, Presence } from "../../utils/types";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "hacker"]),
	};
};

const Hacker: NextPage = () => {
	const router = useRouter();
	const [id] = [router.query.id].flat();
	const { t } = useTranslation("hacker");

	const hackerQuery = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });
	const presenceQuery = trpc.presence.getAllPresences.useQuery({ id: id ?? "" }, { enabled: !!id });
	
	const nextHackerQuery = trpc.hackers.getNext.useQuery({ id: id ?? "" }, { enabled: !!id });
	const prevHackerQuery = trpc.hackers.getPrev.useQuery({ id: id ?? "" }, { enabled: !!id });

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
			title={`${hackerQuery.data.personalInfo?.firstName ?? ""} ${hackerQuery.data.personalInfo?.lastName ?? ""}`}
		>
			<div className="mx-auto flex max-w-2xl flex-col gap-4">
				<OnlyRole filter={role => role === Role.ORGANIZER || role === Role.SPONSOR}>
					<div className="flex justify-between">
						{prevHackerQuery.data ? (
							<a
								href={`/hackers/hacker?id=${prevHackerQuery.data.id}`}
								className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-light-color hover:bg-gray-700"
							>
								Previous
							</a>
						) : (
							<a></a>
						)}
						{nextHackerQuery.data && (
							<a
								href={`/hackers/hacker?id=${nextHackerQuery.data.id}`}
								className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-light-color hover:bg-gray-700"
							>
								Next
							</a>
						)}
					</div>
					<HackerView hackerData={hackerQuery.data} presenceData={presenceQuery} />
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>{t("not-authorized-to-view-this-page")}</OnlyRole>
			</div>
		</App>
	);
};

type HackerViewProps = {
	hackerData: Hacker;
	presenceData: Presence[];
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

const HackerView = ({ hackerData, presenceData }: HackerViewProps) => {
	const router = useRouter();
	const [id] = [router.query.id].flat();
	const { t } = useTranslation("hacker");

	const [presenceState, setPresenceState] = useState(
		Object.fromEntries(
			Object.entries(presenceData).filter(([key]) => key !== "id" && key !== "hackerId"),
		) as Omit<Presence, "id" | "hackerId">,
	);
	const [edit, setEdit] = useState(false);

	const presenceMutation = trpc.presence.update.useMutation();

	const resumeUploadRef = useRef<HTMLInputElement>(null);

	const paragraphClass = "flex justify-between gap-4 text-right py-1.5 ";
	const boldClass = "text-left font-bold";

	
	const fields = [
		{
			label: t("gender"),
			name: "gender",
			default_value: hackerData.personalInfo?.gender,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("firstName"),
			name: "firstName",
			default_value: hackerData.personalInfo?.firstName,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("lastName"),
			name: "lastName",
			default_value: hackerData.personalInfo?.lastName,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("university"),
			name: "university",
			default_value: hackerData.education?.university,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("studyLevel"),
			name: "studyLevel",
			default_value: hackerData.education?.studyLevel?.toUpperCase(),
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("studyProgram"),
			name: "studyProgram",
			default_value: hackerData.education?.studyProgram,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("graduationYear"),
			name: "graduationYear",
			default_value: hackerData.education?.graduationYear,
			type: "number",
			category: t("category_personal_information"),
		},
		{
			label: t("phoneNumber"),
			name: "phoneNumber",
			default_value: hackerData.personalInfo?.phoneNumber,
			type: "number",
			category: t("category_personal_information"),
		},
		{
			label: t("email"),
			name: "email",
			default_value: hackerData.personalInfo?.email,
			type: "email",
			category: t("category_personal_information"),
		},
		{
			label: t("emergencyContactName"),
			name: "emergencyContactName",
			default_value: hackerData.emergency?.name,
			type: "text",
			category: t("category_emergency_contact"),
		},
		{
			label: t("emergencyContactRelationship"),
			name: "emergencyContactRelationship",
			default_value: hackerData.emergency?.relationship,
			type: "text",
			category: t("category_emergency_contact"),
		},
		{
			label: t("emergencyContactPhoneNumber"),
			name: "emergencyContactPhoneNumber",
			default_value: hackerData.emergency?.phoneNumber,
			type: "number",
			category: t("category_emergency_contact"),
		},
		{
			label: t("dietaryRestrictions"),
			name: "dietaryRestrictions",
			default_value: hackerData.dietaryRestrictions,
			type: "text",
			category: t("category_general_information"),
		},
		{
			label: t("accessibilityRequirements"),
			name: "accessibilityRequirements",
			default_value: hackerData.accessibilityRequirements,
			type: "text",
			category: t("category_general_information"),
		},
		{
			label: t("preferredLanguage"),
			name: "preferredLanguage",
			default_value: hackerData.preferredLanguage,
			type: "select",
			options: ["EN", "FR"],
			category: t("category_general_information"),
		},
		{
			label: t("shirtSize"),
			name: "shirtSize",
			default_value: hackerData.shirtSize,
			type: "select",
			options: ["S", "M", "L", "XL", "XXL"],
			category: t("category_general_information"),
		},
		{
			label: t("walkIn"),
			name: "walkIn",
			default_value: hackerData.walkIn,
			type: "select",
			options: ["true", "false"],
			category: t("category_general_information"),
		},
		{
			label: t("subscribeToMailingList"),
			name: "subscribed",
			default_value: hackerData.unsubscribed,
			type: "select",
			options: ["true", "false"],
			category: t("category_general_information"),
		},
		{
			label: t("attendanceType"),
			name: "attendanceType",
			default_value: hackerData.attendanceType,
			type: "select",
			options: ["IN_PERSON", "ONLINE"],
			category: t("category_general_information"),
		},
		{
			label: t("location"),
			name: "location",
			default_value: hackerData.location,
			type: "text",
			category: t("category_general_information"),
		},
		{
			label: t("transportationRequired"),
			name: "transportationRequired",
			default_value: hackerData.transportationRequired,
			type: "select",
			options: ["true", "false"],
			category: t("category_general_information"),
		},
		{
			label: "Linkedin",
			name: "linkLinkedin",
			default_value: hackerData.linkLinkedin,
			type: "url",
			category: t("category_links_information"),
		},
		{
			label: "Github",
			name: "linkGithub",
			default_value: hackerData.linkGithub,
			type: "url",
			category: t("category_links_information"),
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

	const handleUploadResume = () => {
		if (resumeUploadRef.current?.files?.length) {
			const file = resumeUploadRef.current.files[0];
			// TODO: Upload file using presigned URL
		}
	};

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
							<h2 className="self-center px-3 py-2 font-[Coolvetica] text-2xl font-normal text-dark-color">
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
										className="col-md-6 w-[50%] rounded-[100px] border-none bg-light-primary-color px-5 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
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
										className="/50 w-[50%] rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik text-dark-color shadow-md outline-none	transition-all duration-500 hover:bg-dark-primary-color"
										defaultValue={`No ${item.label}`}
										value={inputValues[item.name] ?? ""}
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
					className="rounded-md border border-gray-400 p-2"
					type="file"
					accept="application/pdf"
					onChange={handleUploadResume}
				/>

				<p className="flex flex-row flex-wrap justify-center gap-4 py-4">
					{Object.entries({
						Resume: "",
						LinkedIn: hackerData.socials?.linkedin,
						GitHub: hackerData.socials?.github,
						"Personal Website": hackerData.socials?.personalSite,
					}).map(
						([key, value]) =>
							value && (
								<a
									key={key}
									href={value}
									target="_blank"
									rel="noreferrer"
									className="flex items-center justify-center gap-2 rounded-md bg-dark-color px-4 py-2 text-light-color hover:bg-gray-700"
								>
									{key}
								</a>
							),
					)}
				</p>

				<OnlyRole filter={role => role === Role.ORGANIZER}>
					<>
						<div className="flex justify-center py-4">
							<h2 className="self-center py-4 font-[Coolvetica] text-2xl font-normal text-dark-color ">
								Debug Information
							</h2>
						</div>
						<p className={paragraphClass}>
							<b className={boldClass}>HackerInfo ID</b> {hackerData.id ?? "NULL"}
						</p>
						<p className={paragraphClass}>
							<b className={boldClass}>User ID</b> {hackerData.user?.id ?? "NULL"}
						</p>
						<p className={paragraphClass}>
							<b className={boldClass}>Unsubscribe Token ID</b> {hackerData.preferences?.emailUnsubscribeId ?? "NULL"}
						</p>
						<p className={paragraphClass}>
							<b className={boldClass}>Acceptance Expiry</b>{" "}
							{(hackerData.miscellaneousInfo?.acceptanceExpiry ?? "NULL").toString()}
						</p>
					</>
				</OnlyRole>

				{edit && (
					<div className="sticky bottom-0 mx-2 flex justify-center">
						<div className="flex max-w-md rounded-md bg-dark-color px-2 py-2 text-light-color transition delay-150 ease-in-out">
							<div className="flex flex-col items-center gap-2">
								<p className="px-5 py-2 text-center">{t("edit_description")}</p>
							</div>
							<div className="flex items-center justify-center">
								<button className="px-4 py-2" onClick={resetInputFields}>
									{t("edit_reset_button")}
								</button>
								<button className="h-max w-max rounded-md bg-green-700 px-4 py-2">
									<i className="fas fa-user-edit"></i>
									{t("edit_save_button")}
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
