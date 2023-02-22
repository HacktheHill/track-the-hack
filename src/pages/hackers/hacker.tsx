import { useState } from "react";
import { Role, type Prisma } from "@prisma/client";
import type { GetStaticProps, NextPage } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { trpc } from "../../utils/api";

import App from "../../components/App";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import OnlyRole from "../../components/OnlyRole";

type HackerInfo = Prisma.HackerInfoGetPayload<true>;
type PresenceInfo = Prisma.PresenceInfoGetPayload<true>;

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "hacker"]),
	};
};

const Hacker: NextPage = () => {
	const { t } = useTranslation("hacker");

	const router = useRouter();
	const [id] = [router.query.id].flat();
	const hackerQuery = trpc.hackers.get.useQuery({ id: id ?? "" }, { enabled: !!id });
	const presenceQuery = trpc.presence.getFromHackerId.useQuery({ id: id ?? "" }, { enabled: !!id });

	if (hackerQuery.isLoading || hackerQuery.data == null) {
		return (
			<App>
				<Loading />
			</App>
		);
	} else if (hackerQuery.isError) {
		return (
			<App>
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
			<App>
				<Loading />
			</App>
		);
	} else if (presenceQuery.isError) {
		return (
			<App>
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
		<App>
			<OnlyRole roles={[Role.ORGANIZER, Role.SPONSOR]}>
				<HackerView hackerData={hackerQuery.data} presenceData={presenceQuery.data} />
			</OnlyRole>
			<OnlyRole roles={[Role.HACKER]}>{t("not-authorized-to-view-this-page")}</OnlyRole>
		</App>
	);
};

type HackerViewProps = {
	hackerData: HackerInfo;
	presenceData: PresenceInfo;
};

const HackerView = ({ hackerData, presenceData: { id: _, ...presenceData } }: HackerViewProps) => {
	const router = useRouter();
	const [id] = [router.query.id].flat();
	const presenceMutation = trpc.presence.update.useMutation();
	const [presenceState, setPresenceState] = useState(presenceData);

	return (
		// overflow auto
		<div className="flex flex-col overflow-auto">
			<h1 className="font-coolvetica text-[clamp(1rem,3.5vmin,5rem)] font-normal text-dark">
				{hackerData.firstName} {hackerData.lastName}
			</h1>
			<OnlyRole roles={[Role.ORGANIZER]}>
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
						<label htmlFor={key}>{key}</label>
					</p>
				))}
				<br />
			</OnlyRole>
			{...Object.keys(hackerData).map(key => (
				<div key={key}>
					<b>{key}</b>: {(hackerData[key as keyof HackerInfo] ?? "NULL").toString()}
				</div>
			))}
		</div>
	);
};

export default Hacker;
