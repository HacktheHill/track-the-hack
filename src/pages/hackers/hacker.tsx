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

type HackerInfo = Prisma.HackerInfoGetPayload<true>;
type PresenceInfo = Prisma.PresenceInfoGetPayload<true>;

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
	
	const nextHackerQuery = trpc.hackers.getNext.useQuery({ id: id ?? "" }, { enabled: !!id });
	const prevHackerQuery = trpc.hackers.getPrev.useQuery({ id: id ?? "" }, { enabled: !!id });

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
					<div className="flex justify-between">
						{prevHackerQuery.data ? (<a
							href={`/hackers/hacker?id=${prevHackerQuery.data.id}`}
							className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
						>
							Previous
						</a>
						) : (
							<a></a>
						)}
						{nextHackerQuery.data && ( <a
							href={`/hackers/hacker?id=${nextHackerQuery.data.id}`}
							className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
						>
							Next
						</a>
						)}
					</div>
					<HackerView hackerData={hackerQuery.data} presenceData={presenceQuery.data} />
				</OnlyRole>
				<OnlyRole filter={role => role === Role.HACKER}>{t("not-authorized-to-view-this-page")}</OnlyRole>
			</div>
		</App>
	);
};

export const keyToLabel = {
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

	const paragraphClass = "flex justify-between gap-4 text-right";
	const boldClass = "text-left font-bold";

	return (
		<>
			<h1 className="self-center font-coolvetica text-4xl font-normal text-dark">
				{hackerData.firstName} {hackerData.lastName} ({hackerData.gender})
			</h1>
			<p className="self-center">
				{hackerData.studyLevel} {hackerData.studyProgram}{" "}
				{hackerData.university && `at ${hackerData.university}`}{" "}
				{hackerData.graduationYear && `(${hackerData.graduationYear})`}
			</p>
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				<div className="grid grid-flow-row grid-cols-2 gap-4 rounded-lg bg-background2 p-4">
					{Object.entries(presenceState).map(([key, value]) => (
						<p key={key}>
							<input
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
			<h2 className="self-center font-[Coolvetica] text-2xl font-normal text-dark">General Information</h2>
			<p className={paragraphClass}>
				<b className={boldClass}>Contact Information</b> {hackerData.email} &mdash; {hackerData.phoneNumber}
			</p>
			<p className={paragraphClass}>
				<b className={boldClass}>Emergency Contact</b> {hackerData.emergencyContactName} (
				{hackerData.emergencyContactRelationship}) {hackerData.emergencyContactPhoneNumber}
			</p>
			<p className={paragraphClass}>
				<b className={boldClass}>Requirements</b>
				{hackerData.dietaryRestrictions
					? hackerData.dietaryRestrictions
					: "No Dietary Restrictions"} &mdash;{" "}
				{hackerData.accessibilityRequirements
					? hackerData.accessibilityRequirements
					: "No Accessibility Requirements"}{" "}
				&mdash; {hackerData.preferredLanguage} &mdash; {hackerData.shirtSize}
			</p>
			<p className={paragraphClass}>
				<b className={boldClass}>Attendance</b>
				{hackerData.confirmed ? "Confirmed attendance" : "Unconfirmed attendance"}
				{hackerData.walkIn ? " (walk-in)" : ""} &mdash;{" "}
				{hackerData.unsubscribed ? "Unsubscribed from emails" : "Subscribed to emails"} &mdash; Attends{" "}
				{hackerData.attendanceType} at {hackerData.location} with{" "}
				{hackerData.transportationRequired ? "" : "no"} transportation required
			</p>
			<p className="flex flex-row flex-wrap gap-4">
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
								className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
							>
								{key}
							</a>
						),
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
		</>
	);
};

export default Hacker;
