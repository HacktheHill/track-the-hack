import { Role, type Prisma } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useState } from "react";
import { trpc } from "../../utils/api";

import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import OnlyRole from "../../components/OnlyRole";
import Link from "next/link";

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
		<App
			className="mx-auto h-full w-full overflow-y-auto bg-gradient-to-b from-background2 to-background1 px-4 py-12"
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const HackerView = ({ hackerData, presenceData: { id: _, hackerInfoId, ...presenceData } }: HackerViewProps) => {
	const router = useRouter();
	const [id] = [router.query.id].flat();

	const presenceMutation = trpc.presence.update.useMutation();
	const [presenceState, setPresenceState] = useState(presenceData);

	const paragraphClass = "flex justify-between gap-4 text-right ";
	const boldClass = "text-left font-bold";

	const [edit, setEdit] = useState(false);
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
	} as const satisfies Record<keyof Omit<PresenceInfo, "id" | "hackerInfoId">, string>;

	return (
		<>
			<h1 className="self-center font-coolvetica text-4xl font-normal text-dark">
				{hackerData.firstName} {hackerData.lastName} ({hackerData.gender})
			</h1>
			<p className="self-center">
				{hackerData.studyLevel?.toUpperCase()} {hackerData.studyProgram}{" "}
				{hackerData.university && `at ${hackerData.university}`}{" "}
				{hackerData.graduationYear && `(${hackerData.graduationYear})`}
			</p>
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				<div className="grid grid-flow-row grid-cols-2 gap-4 rounded-lg bg-background2 p-4">
					{Object.entries(presenceState).map(([key, value]) => (
						<p key={key}>
							<input
								className="form-checkbox accent-[#3b4779] h-3.5 w-5 text-gray-800 rounded "
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

			<div className="flex justify-center ">
						<h2 className="self-center font-[Coolvetica] text-2xl font-normal text-dark px-3 py">{edit ? "Edit Informations" : "Personnal Information"}</h2>
						<Link href={`/edit?id=${hackerData.id}`}>
							<button className="text-sm px-3 py-1 bg-gray-800 rounded text-white hover:bg-gray-700">Edit</button>
						</Link>
			</div>


				<div>
					<p className={paragraphClass}>
						<b className={boldClass}>Email Address</b> {hackerData.gender}
					</p>

					<p className={paragraphClass}>
						<b className={boldClass}>First Name</b> {hackerData.firstName}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Last Name</b> {hackerData.lastName}
					</p>

					<p className={paragraphClass}>
						<b className={boldClass}>University</b> {hackerData.university}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Study Level</b> {hackerData.studyLevel?.toUpperCase()}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Study Program</b> {hackerData.studyProgram}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Graduation Year</b> {hackerData.graduationYear}
					</p>

					<div className="flex justify-center">
						<h2 className="self-center font-[Coolvetica] text-2xl font-normal text-dark px-3 py">Emergency Contact</h2>
						{!edit && (
							<button
								onClick={() => setEdit(true)}
								className="text-sm px-3 py-1 bg-gray-800 rounded text-white hover:bg-gray-700"
							>
								Edit
							</button>
						)}
					</div>

					<p className={paragraphClass}>
						<b className={boldClass}>Contact Name</b> {hackerData.emergencyContactName}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Contact Relationship</b> {hackerData.emergencyContactRelationship}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Contact Phone Number</b> {hackerData.emergencyContactPhoneNumber}
					</p>

					<div className="flex justify-center">
						<h2 className="self-center font-[Coolvetica] text-2xl font-normal text-dark px-3 py">General Information</h2>
						{!edit && (
							<button
								onClick={() => setEdit(true)}
								className="text-sm px-3 py-1 bg-gray-800 rounded text-white hover:bg-gray-700"
							>
								Edit
							</button>
						)}
					</div>

					<p className={paragraphClass}>
						<b className={boldClass}>Dietary Restrictions</b>{" "}
						{hackerData.dietaryRestrictions !== "None" ? hackerData.dietaryRestrictions : "No Dietary Restrictions"}
					</p>

					<p className={paragraphClass}>
						<b className={boldClass}>Accessibility Requirements</b>{" "}
						{hackerData.accessibilityRequirements !== "None"
							? hackerData.accessibilityRequirements
							: "No Accessibility Requirements"}
					</p>

					<p className={paragraphClass}>
						<b className={boldClass}>Preferred Language</b>
						{hackerData.preferredLanguage}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Shirt Size</b>
						{hackerData.shirtSize}
					</p>

					<p className={paragraphClass}>
						<b className={boldClass}>Confirmed</b>
						{hackerData.confirmed ? "Confirmed attendance" : "Unconfirmed attendance"}
					</p>

					<p className={paragraphClass}>
						<b className={boldClass}>Walk In</b>
						{hackerData.walkIn ? " Walk-In" : ""}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Subscribed</b>{" "}
						{hackerData.unsubscribed ? "Unsubscribed from emails" : "Subscribed to emails"}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>AttendanceType</b>
						{hackerData.attendanceType}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Location</b>
						{hackerData.location}
					</p>
					<p className={paragraphClass}>
						<b className={boldClass}>Transportation Required</b>{" "}
						{hackerData.transportationRequired ? "Transportation Required" : "No Transportation Required"}
					</p>

					<p className="flex flex-row flex-wrap gap-4 justify-center">
						{Object.entries({
							Resume: hackerData.linkResume,
							LinkedIn: hackerData.linkLinkedin,
							GitHub: hackerData.linkGithub,
							"Personal Website": hackerData.linkPersonalSite,
						}).map(([key, value]) =>
								value && (
									<a
										key={key}
										href={value}
										target="_blank"
										rel="noreferrer"
										className="flex items-center justify-center gap-2 rounded-md bg-dark px-4 py-2 text-white hover:bg-gray-700"
									>
										{key}
									</a>
								)
						)}
					</p>


					<OnlyRole filter={role => role === Role.ORGANIZER}>
						<>
							<h2 className="self-center font-[Coolvetica] text-2xl font-normal text-dark">Debug Information</h2>
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
				</div>
		</>
	);
};

export default Hacker;
