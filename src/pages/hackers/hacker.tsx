import { Locale, RoleName, TShirtSize, type Prisma } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useState } from "react";
import { trpc } from "../../server/api/api";

import { z } from "zod";
import { uploadResume } from "../../client/s3";
import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";
import Loading from "../../components/Loading";
import { hackerSchema } from "../../utils/common";

type Hacker = Prisma.HackerGetPayload<true>;
type Presence = Prisma.PresenceGetPayload<true>;

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
	const presenceQuery = trpc.presence.getFromHackerId.useQuery({ id: id ?? "" }, { enabled: !!id });

	const nextHackerQuery = trpc.hackers.getNext.useQuery(
		{ id: id ?? "" },
		{
			enabled: !!id,
			refetchOnMount: false,
		},
	);
	const prevHackerQuery = trpc.hackers.getPrev.useQuery(
		{ id: id ?? "" },
		{
			enabled: !!id,
			refetchOnMount: false,
		},
	);

	if (hackerQuery.isLoading || hackerQuery.data == null) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Filter value={[RoleName.ORGANIZER, RoleName.SPONSOR]} method="some">
					<Loading />
					<Error message={t("common:unauthorized")} />
				</Filter>
			</App>
		);
	} else if (hackerQuery.isError) {
		return (
			<App className="h-full bg-default-gradient px-16 py-12">
				<Error message={hackerQuery.error.message} />
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
				<Error message={presenceQuery.error.message} />
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
				<Filter value={[RoleName.ORGANIZER, RoleName.SPONSOR]} method="some">
					<>
						<div className="flex justify-between">
							{prevHackerQuery.data && (
								<a
									href={`/hackers/hacker?id=${prevHackerQuery.data.id}`}
									className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-light-color hover:bg-gray-700"
								>
									Previous
								</a>
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
						<HackerView hackerData={hackerQuery.data} presenceData={presenceQuery.data} />
					</>
					<Error message={t("common:unauthorized")} />
				</Filter>
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
	defaultValue: string | boolean | number | null;
	type: "text" | "number" | "email" | "select" | "url";
	category: string;
	options?: string[];
};

const HackerView = ({ hackerData, presenceData }: HackerViewProps) => {
	const router = useRouter();
	const [id] = [router.query.id].flat();
	const { t } = useTranslation("hacker");

	const [edit, setEdit] = useState(false);

	const downloadResume = trpc.hackers.downloadResume.useQuery(
		{ id: id ?? "" },
		{ enabled: !!id && !!hackerData.hasResume },
	);

	const paragraphClass = "flex justify-between gap-4 text-right py-1.5 ";
	const boldClass = "text-left font-bold";

	const fields = [
		{
			label: t("gender"),
			name: "gender",
			defaultValue: hackerData.gender,
			type: "select",
			options: ["man", "woman", "nonBinary", "other", "preferNotToAnswer"],
			category: t("category_personal_information"),
		},
		{
			label: t("firstName"),
			name: "firstName",
			defaultValue: hackerData.firstName,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("lastName"),
			name: "lastName",
			defaultValue: hackerData.lastName,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("university"),
			name: "university",
			defaultValue: hackerData.currentSchoolOrganization,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("studyLevel"),
			name: "studyLevel",
			defaultValue: hackerData.educationLevel,
			type: "select",
			options: ["highSchool", "undergraduate", "graduate", "other"],
			category: t("category_personal_information"),
		},
		{
			label: t("studyProgram"),
			name: "studyProgram",
			defaultValue: hackerData.major,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("phoneNumber"),
			name: "phoneNumber",
			defaultValue: hackerData.phoneNumber,
			type: "text",
			category: t("category_personal_information"),
		},
		{
			label: t("email"),
			name: "email",
			defaultValue: hackerData.email,
			type: "email",
			category: t("category_personal_information"),
		},
		{
			label: t("emergencyContactName"),
			name: "emergencyContactName",
			defaultValue: hackerData.emergencyContactName,
			type: "text",
			category: t("category_emergency_contact"),
		},
		{
			label: t("emergencyContactRelationship"),
			name: "emergencyContactRelationship",
			defaultValue: hackerData.emergencyContactRelation,
			type: "text",
			category: t("category_emergency_contact"),
		},
		{
			label: t("emergencyContactPhoneNumber"),
			name: "emergencyContactPhoneNumber",
			defaultValue: hackerData.emergencyContactPhoneNumber,
			type: "text",
			category: t("category_emergency_contact"),
		},
		{
			label: t("dietaryRestrictions"),
			name: "dietaryRestrictions",
			defaultValue: hackerData.dietaryRestrictions,
			type: "select",
			options: [
				"halal",
				"glutenFree",
				"vegetarian",
				"vegan",
				"kosher",
				"lactoseIntolerance",
				"nuts",
				"soy",
				"none",
				"other",
			],
			category: t("category_general_information"),
		},
		{
			label: t("accessibilityRequirements"),
			name: "accessibilityRequirements",
			defaultValue: hackerData.specialAccommodations,
			type: "text",
			category: t("category_general_information"),
		},
		{
			label: t("preferredLanguage"),
			name: "preferredLanguage",
			defaultValue: hackerData.preferredLanguage,
			type: "select",
			options: Object.values(Locale),
			category: t("category_general_information"),
		},
		{
			label: t("shirtSize"),
			name: "shirtSize",
			defaultValue: hackerData.tShirtSize,
			type: "select",
			options: Object.values(TShirtSize),
			category: t("category_general_information"),
		},
		{
			label: t("walkIn"),
			name: "walkIn",
			defaultValue: hackerData.walkIn,
			type: "select",
			options: ["true", "false"],
			category: t("category_general_information"),
		},
		{
			label: t("subscribeToMailingList"),
			name: "subscribed",
			defaultValue: !hackerData.unsubscribed,
			type: "select",
			options: ["true", "false"],
			category: t("category_general_information"),
		},
		{
			label: "Linkedin",
			name: "linkLinkedin",
			defaultValue: hackerData.linkedin,
			type: "url",
			category: t("category_links_information"),
		},
		{
			label: "Github",
			name: "linkGithub",
			defaultValue: hackerData.github,
			type: "url",
			category: t("category_links_information"),
		},
		{
			label: "Personal Website",
			name: "linkPersonalSite",
			defaultValue: hackerData.personalWebsite,
			type: "url",
			category: t("category_links_information"),
		},
	] as const satisfies Field[];

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
		initialInputValues[field.name] = field.defaultValue as string;
	});

	fields.forEach(item => {
		const field = item;
		if (!groupedData[field.category]) {
			groupedData[field.category] = [];
		}
		groupedData[field.category]?.push(field);
	});

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const data = Object.fromEntries(formData) as Record<string, string | boolean | number | undefined>;
		data.id = id;

		const resume = formData.get("resume") as File | null;
		data.hasResume = !!resume;

		const parse = hackerSchema
			.extend({
				id: z.string(),
			})
			.safeParse(data);

		if (!parse.success) {
			console.error("Validation Error:", parse.error);
		} else {
			console.log("Data parsed", parse.data);
			const result = await mutation.mutateAsync(parse.data);
			if (result.presignedUrl && resume) {
				await uploadResume(result.presignedUrl, resume, resume.name);
			}

			if (!mutation.error) {
				event.currentTarget?.reset();
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

			<Filter value={[RoleName.ORGANIZER]} method="some">
				<div className="grid grid-flow-row grid-cols-2 gap-4 rounded-lg bg-light-tertiary-color p-4">
					{presenceData.map((presence, index) => (
						<div key={index} className="flex justify-between gap-4">
							<p>
								<b>{presence.label}</b>
							</p>
							<p>{presence.value}</p>
						</div>
					))}
				</div>
			</Filter>

			<form onSubmit={e => void handleSubmit(e)}>
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
									/>
								)}
							</div>
						))}
					</div>
				))}

				<input
					name="resume"
					className="rounded-md border border-gray-400 p-2"
					type="file"
					accept="application/pdf"
					onChange={e => {
						handleInputChange("resume", e.target.value);
					}}
				/>

				<p className="flex flex-row flex-wrap justify-center gap-4 py-4">
					{Object.entries({
						Resume: downloadResume.data,
						LinkedIn: hackerData.linkedin,
						GitHub: hackerData.github,
						"Personal Website": hackerData.personalWebsite,
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

				<Filter value={RoleName.ORGANIZER} method="above">
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
				</Filter>

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
