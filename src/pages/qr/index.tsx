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
import { faker } from "@faker-js/faker";
import { TRPCClientError } from "@trpc/client";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Hacker = RouterOutput["hackers"]["get"];
type Presence = RouterOutput["presence"]["getFromHackerId"];

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
	const {data:hacker, refetch:refetchHacker} = trpc.hackers.get.useQuery({ id: hackerID }, { enabled: false });
	const {data:presences, refetch:refetchPresences} = trpc.presence.getFromHackerId.useQuery({ id: hackerID }, { enabled: false });

	const presenceUpsertMutation = trpc.presence.upsert.useMutation();
	const presenceIncrementMutation = trpc.presence.increment.useMutation();

	const [display, setDisplay] = useState(<></>);

	const handleMealEvent = async (event: EVENTS, hacker:Hacker, presences: Presence | undefined) => {
		// Hacker already registered -> increment
		if (presences && presences.length > 0) {
			for (const presence of presences) {
				if (presence.label === event) {
					try {
						await presenceIncrementMutation.mutateAsync({key: presence.key});
						return <div>{hacker.firstName} has checked-in {presence.value + 1} times!</div>;
					} catch (error) {
						if (error instanceof TRPCClientError) {
							return <div>Error: {error.message}</div>;
						}
						return <div>An unknown error occurred!</div>;
					}
				}
			}
		}
	
		// First check-in
		try {
			await presenceUpsertMutation.mutateAsync({key: faker.helpers.slugify(faker.lorem.words(2)), value: 1, label: event})
			return <div>{hacker.firstName} successfully check-in for {event}</div>;
		} catch (error) {
			if (error instanceof TRPCClientError) {
				return <div>Error: {error.message}</div>;
			}
			return <div>An unknown error occurred!</div>;
		}
	}

	useEffect(() => {
		console.info("Hacker ID: ", hackerID);
		(() =>{
			if (!hackerID || hackerID === "") return;
			void refetchHacker();

			if (selectedEvent != EVENTS.GET_HACKER) void refetchPresences();
		})()
	}, [hackerID]);

	useEffect(() => {
		async function handleEvenet () {
			if (!hacker) return;

			switch (selectedEvent) {
			case EVENTS.NONE:
				break;
			case EVENTS.GET_HACKER:
				setDisplay(
				<div
					className="hover:bg-medium block w-full rounded-lg bg-medium-primary-color p-6 text-light-color shadow"
				>
					<h3 className="text-2xl font-bold tracking-tight">{`${hacker.firstName} ${hacker.lastName}`}</h3>
					<p>{hacker.major}</p>
					<p>{hacker.currentSchoolOrganization}</p>
					<p>{hacker.email}</p>
					<p>{hacker.phoneNumber}</p>
					<p>{hacker.gender}</p>
					<p>{hacker.major}</p>
				</div>);
				break;
			case EVENTS.OPENING_CEREMONY:
				if (presences && presences.length > 0) {
					for (const presence of presences) {
						// Hacker already registered
						if (presence.label === EVENTS.OPENING_CEREMONY) {
							setDisplay(
								<div>Error: hacker already checked in for opening ceremony!</div>
							);
							return
						}
					}
				}
				// Hacker not registered. TODO: is key randomly generated?
				presenceUpsertMutation.mutate({key: faker.helpers.slugify(faker.lorem.words(2)), value: 1, label: EVENTS.OPENING_CEREMONY});
				setDisplay(
					<div>{hacker.firstName} successfully check-in for {EVENTS.OPENING_CEREMONY}</div>
				);
				break;
			case EVENTS.FRIDAY_DINNER:
				setDisplay(await handleMealEvent(EVENTS.FRIDAY_DINNER, hacker, presences));
				break
			case EVENTS.SATURDAY_BREAKFAST:
				setDisplay(await handleMealEvent(EVENTS.SATURDAY_BREAKFAST, hacker, presences));
				break;
			case EVENTS.SATURDAY_LAUNCH:
				setDisplay(await handleMealEvent(EVENTS.SATURDAY_LAUNCH, hacker, presences));
				break;
			case EVENTS.SATURDAY_DINNER:
				setDisplay(await handleMealEvent(EVENTS.SATURDAY_DINNER, hacker, presences));
				break;
			case EVENTS.SUNDAY_BREAKFAST:
				setDisplay(await handleMealEvent(EVENTS.SUNDAY_BREAKFAST, hacker, presences));
				break;
			default:
				alert("Unhandled action!")
				break;
			}
		}
		void handleEvenet();
		
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
