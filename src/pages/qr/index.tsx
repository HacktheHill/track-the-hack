import { RoleName } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useTranslation } from "next-i18next";
import { useEffect, useState } from "react";
import { qrRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "../../components/App";
import Filter from "../../components/Filter";
import PhysicalScanner from "../../components/PhysicalScanner";
import QRCode from "../../components/QRCode";
import QRScanner from "../../components/QRScanner";
import { trpc } from "../../server/api/api";
import type { AppRouter } from "../../server/api/root";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Hacker = RouterOutput["hackers"]["get"];

// TODO: sync it with db
enum EVENTS {
	NONE = "Select an event",
	OPENING_CEREMONY = "Opening Ceremony",
	FRIDAY_DINNER = "Friday Dinner",
	SATURDAY_BREAKFAST = "Saturday Breakfast",
	SATURDAY_LAUNCH = "Saturday Lunch",
	SATURDAY_DINNER = "Saturday Dinner",
	SUNDAY_BREAKFAST = "Sunday Breakfast",
	GET_HACKER = "Get Hacker info"
}

type EVENTS_T = keyof typeof EVENTS;

const QR = () => {
	const { t } = useTranslation("qr");
	const [error, setError] = useState(false);

	const [selectedEvent, selectEvent] = useState(EVENTS.NONE);
	const events = Object.keys(EVENTS) as EVENTS_T[];

	const [hackerID, setHackerID] = useState<string>("");
	const {data:hacker, refetch} = trpc.hackers.get.useQuery({ id: hackerID }, { enabled: false });

	const [display, setDisplay] = useState(<></>);

	useEffect(() => {
		console.info("Hacker ID: ", hackerID);
		(() =>{
			if (!hackerID || hackerID === "") return;
			void refetch();
		})()
	}, [hackerID]);

	useEffect(() => {
		if (!hacker) return;

		switch (selectedEvent) {
			case EVENTS.NONE:
				break;
			case EVENTS.GET_HACKER:
				setDisplay(<Card hacker={hacker} />);
				break;
			case EVENTS.OPENING_CEREMONY:
			case EVENTS.FRIDAY_DINNER:
			case EVENTS.SATURDAY_BREAKFAST:
			case EVENTS.SATURDAY_LAUNCH:
			case EVENTS.SATURDAY_DINNER:
			case EVENTS.SUNDAY_BREAKFAST:
			default:
				alert("Unhandled action!")
				break;
		}
	}, [hacker]);

	return (
		<App
			className="relative flex h-full flex-col items-center justify-center gap-16 bg-default-gradient"
			title={t("title")}
		>
			<div className="flex flex-col items-center gap-6">
				<Filter value={[RoleName.ORGANIZER]} method="some">
					<>
						<select 
						    className="p-3 text-center text-lg font-bold text-dark-color"
							onChange={e => selectEvent(EVENTS[e.target.value as EVENTS_T])}>
							{events.map(event => {
								return (
									<option key={event} value={event}>
										{EVENTS[event]}
									</option>
								);
							})}
						</select>

						{(selectedEvent != EVENTS.NONE) ? <QRScanner onScan={setHackerID} />:null}
						<PhysicalScanner onScan={setHackerID} />
						{!error && (
							<p className="z-10 max-w-xl text-center text-lg font-bold text-dark-color">
								{t("scan-qr")}
							</p>
						)}
					</>
					<>
						<QRCode setError={setError} />
						{!error && (
							<p className="z-10 max-w-xl text-center text-lg font-bold text-dark-color">{t("use-qr")}</p>
						)}
					</>
				</Filter>
				{display}
			</div>
			{error && (
				<div className="flex h-40 items-center justify-center text-dark-color">
					<p>{t("sign-in-to-access")}</p>
				</div>
			)}
		</App>
	);
};


function Card({hacker}:{hacker: Hacker}) {
	if (!hacker) return <></>;

	return <div
		className="hover:bg-medium block w-full rounded-lg bg-medium-primary-color p-6 text-light-color shadow"
	>
		<h3 className="text-2xl font-bold tracking-tight">{`${hacker.firstName} ${hacker.lastName}`}</h3>
		<p>{hacker.major}</p>
		<p>{hacker.currentSchoolOrganization}</p>
		<p>{hacker.email}</p>
		<p>{hacker.phoneNumber}</p>
		<p>{hacker.gender}</p>
		<p>{hacker.major}</p>
	</div>
}

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await qrRedirect(session, "/qr"),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["qr", "navbar", "common"])),
		},
	};
};

export default QR;
