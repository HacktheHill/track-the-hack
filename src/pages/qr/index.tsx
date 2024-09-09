import { RoleName } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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
import type { TRPCClientErrorLike } from "@trpc/client";
import { TRPCClientError } from "@trpc/client";
import type { UseMutateAsyncFunction } from "@tanstack/react-query";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Hacker = RouterOutput["hackers"]["get"];
type Presence = RouterOutput["presence"]["getFromHackerId"][0];

enum ACTIONS {
	NONE = "Select an event",
	GET_HACKER = "Get Hacker info",
}

const QR = () => {
	const { t } = useTranslation("qr");
	const router = useRouter();
	const [error, setError] = useState(false);

	const [selectedAction, setSelectedAction] = useState<string>(ACTIONS.NONE);
	const actions: string[] = Object.keys(ACTIONS).map(key => ACTIONS[key as keyof typeof ACTIONS]);
	const { data: events } = trpc.events.all.useQuery();

	const [hackerId, setHackerId] = useState<string>("");
	const [prevId, setPrevId] = useState<string>("");

	const { data: hacker, refetch: refetchHacker } = trpc.hackers.get.useQuery({ id: hackerId }, { enabled: false });
	const { data: presences, refetch: refetchPresences } = trpc.presence.getFromHackerId.useQuery(
		{ id: hackerId },
		{ enabled: false },
	);

	const { mutateAsync: presenceUpsertMutateAsync } = trpc.presence.upsert.useMutation();
	const { mutateAsync: presenceIncrementMutateAsync } = trpc.presence.increment.useMutation();

	const [display, setDisplay] = useState(<></>);

	const utils = trpc.useUtils();

	// Memoize function to prevent re-rendering QRScanner. QRScanner should never be re-rendered or it will break.
	const onScan = useCallback((result: string) => {
		if (!result) return;
		setHackerId(result);
	}, []);

	useEffect(() => {
		async function handleEvent() {
			const maxCheckIns = events?.find(event => event.name === selectedAction)?.maxCheckIns as number | null;

			if (!hacker || !presences) return;

			// Hacker already registered -> increment
			if (presences.length > 0) {
				for (const presence of presences) {
					if (presence.label != selectedAction) continue;
					try {
						setDisplay(
							<Result
								hacker={hacker}
								presence={presence}
								maxCheckIns={maxCheckIns}
								mutate={presenceIncrementMutateAsync}
							/>,
						);
						return;
					} catch (error) {
						if (error instanceof TRPCClientError) {
							setDisplay(<div>Error: {error.message}</div>);
							return;
						}
						setDisplay(<div>An unknown error occurred!</div>);
						return;
					}
				}
			}

			// First check-in
			try {
				await presenceUpsertMutateAsync({ hackerId, value: 1, label: selectedAction });
				setDisplay(
					<div>
						{hacker.firstName} {hacker.lastName} successfully checked-in for {selectedAction}
					</div>,
				);
			} catch (error) {
				if (error instanceof TRPCClientError) {
					setDisplay(<div>Error: {error.message}</div>);
					return;
				}
				setDisplay(<div>An unknown error occurred!</div>);
			}
		}

		void handleEvent();
	}, [presences]);

	async function clearData() {
		await utils.hackers.get.reset();
		await utils.presence.getFromHackerId.reset();
	}

	async function handleRefetch() {
		// Reset hacker and presences data
		await clearData();

		await refetchHacker();
		await refetchPresences();
	}

	useEffect(() => {
		if (hackerId === prevId) return;
		console.log("hackerId changed", hackerId, "!=", prevId);
		setPrevId(hackerId);

		if (hackerId === "") {
			// Clear data when selectedAction is changed
			void clearData();
			return;
		}

		void (async () => {
			switch (selectedAction) {
				case ACTIONS.NONE:
					break;
				case ACTIONS.GET_HACKER:
					router.push(`/hackers/hacker?id=${hackerId}`);
					break;
				default:
					await handleRefetch();
					break;
			}
		})();
	}, [hackerId, selectedAction]);

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
							onChange={e => {
								setSelectedAction(e.target.value);
								setHackerId("");
								setDisplay(<></>);
							}}
						>
							{(events ? actions.concat(events?.map(event => event.name)) : actions).map(event => {
								return (
									<option key={event} value={event}>
										{event}
									</option>
								);
							})}
						</select>

						{selectedAction !== ACTIONS.NONE ? <QRScanner onScan={onScan} /> : null}
						<PhysicalScanner onScan={onScan} />
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

type ResultProps = {
	hacker: Hacker;
	presence: Presence;
	maxCheckIns: number | null;
	mutate: UseMutateAsyncFunction<void, TRPCClientErrorLike<any>, { id: string }>;
};
const Result = ({ hacker, presence, maxCheckIns, mutate }: ResultProps) => {
	const [counter, setCounter] = useState(0);

	useEffect(() => {
		setCounter(presence.value);
	}, [presence]);

	const handleIncrement = async () => {
		setCounter(counter + 1);
		await mutate({ id: presence.id });
	};
	return (
		<div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-light-primary-color p-6 text-light-color">
			<div>
				{hacker.firstName} {hacker.lastName} has already checked-in {counter} times!
			</div>
			{!maxCheckIns || maxCheckIns > presence.value ? (
				<button
					className="z-10 w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors hover:bg-light-tertiary-color mobile:px-8 mobile:py-4 mobile:text-4xl"
					onClick={() => void handleIncrement()}
				>
					Increment
				</button>
			) : (
				<div>ERROR: Max {maxCheckIns} check-ins allowed!</div>
			)}
		</div>
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
