import { AcceptanceStatus, RoleName } from "@prisma/client";
import { TRPCClientError } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useTranslation } from "next-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppRouter } from "../../server/api/root";

import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import router from "next/router";
import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";
import PhysicalScanner from "../../components/PhysicalScanner";
import QRCode from "../../components/QRCode";
import QRScanner from "../../components/QRScanner";
import ScanResult from "../../components/ScanResult";
import { env } from "../../env/server.mjs";
import { trpc } from "../../server/api/api";
import { encrypt } from "../../server/api/routers/qr";
import { qrRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";
import Tabs from "../../components/Tabs";
import { playErrorSound, playNeutralSound, playSuccessSound } from "../../client/sound";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Hacker = RouterOutput["presence"]["getScanInfo"];
type ScanEvent = RouterOutput["events"]["all"][0];

const DEFAULT_ACTION = "get-hacker";

const QR = ({ encryptedId }: { encryptedId: string }) => {
	const { t, i18n } = useTranslation("qr");

	const selectedAction = useRef<string>(DEFAULT_ACTION);
	const prevHackerId = useRef<string>("");
	const scanPending = useRef(false);
	const [isScanning, setIsScanning] = useState(false);

	const [error, setError] = useState("");
	const [menuOptions, setMenuOptions] = useState<string[]>([]);
	const [display, setDisplay] = useState(<></>);

	const { data: events } = trpc.events.all.useQuery();
	const { mutateAsync: presenceUpsertMutateAsync } = trpc.presence.upsert.useMutation();
	const { mutateAsync: presenceIncrementMutateAsync } = trpc.presence.increment.useMutation();

	const utils = trpc.useUtils();

	useEffect(() => {
		const validEvents =
			events
				?.filter(event => event.end.getTime() + 30 * 60 * 1000 > Date.now())
				.filter((event, index, self) => self.findIndex(e => e.name === event.name) === index)
				.sort((a, b) => a.start.getTime() - b.start.getTime())
				.map(event => event.name) ?? [];

		setMenuOptions([DEFAULT_ACTION, ...validEvents]);
	}, [events]);

	// Reload page to re-render a new QRScanner
	useEffect(() => {
		const handleLanguageChange = () => {
			window.location.reload();
		};

		i18n.on("languageChanged", handleLanguageChange);

		return () => {
			i18n.off("languageChanged", handleLanguageChange);
		};
	}, [i18n]);

	const handleEvent = useCallback(
		async (hacker: Hacker, event: ScanEvent) => {
			if (hacker.acceptanceStatus !== AcceptanceStatus.ACCEPTED) {
				playErrorSound();
				setDisplay(<NotHackerError />);
				return;
			}

			// Presence labels are event names in the existing database.
			const presence = hacker.presences.find(item => item.label === event.name);
			if (presence) {
				playNeutralSound();
				setDisplay(
					<ScanResult
						key={`${hacker.id}:${event.id}:${presence.id}`}
						hacker={hacker}
						event={event}
						initialCount={presence.value}
						interestedEvents={hacker.eventInterests.map(interest => interest.Event)}
						repeated
						onIncrement={value => presenceIncrementMutateAsync({ id: presence.id, value })}
					/>,
				);
				return;
			}

			await presenceUpsertMutateAsync({ hackerId: hacker.id, value: 1, label: event.name });
			playSuccessSound();
			setDisplay(
				<ScanResult
					key={`${hacker.id}:${event.id}`}
					hacker={hacker}
					event={event}
					initialCount={1}
					interestedEvents={hacker.eventInterests.map(interest => interest.Event)}
					repeated={false}
				/>,
			);
		},
		[presenceIncrementMutateAsync, presenceUpsertMutateAsync],
	);

	const handleScanResult = useCallback(
		async (hackerId: string) => {
			if (!hackerId || hackerId === prevHackerId.current || scanPending.current) return;
			const action = selectedAction.current;
			if (action === DEFAULT_ACTION) {
				prevHackerId.current = hackerId;
				void router.push(`/hackers/hacker?id=${hackerId}`);
				return;
			}

			const event = events?.find(item => item.name === action);
			if (!event) return;
			scanPending.current = true;
			setIsScanning(true);
			setDisplay(<></>);
			setError("");
			try {
				const hacker = await utils.presence.getScanInfo.fetch({ id: hackerId });
				await handleEvent(hacker, event);
				prevHackerId.current = hackerId;
			} catch (error) {
				playErrorSound();
				setDisplay(error instanceof TRPCClientError ? <Error message={error.message} /> : <UnknownError />);
			} finally {
				scanPending.current = false;
				setIsScanning(false);
			}
		},
		[events, handleEvent, utils],
	);

	// Memoize function to prevent re-rendering QRScanner. QRScanner should never be re-rendered or it will break.
	// React does not properly re-render video components.
	const onScan = useCallback(
		(result: string) => {
			console.debug("Scan result:", result);
			void handleScanResult(result);
		},
		[handleScanResult],
	);

	return (
		<App
			className="relative flex h-full flex-col items-center gap-8 overflow-y-auto bg-default-gradient px-4 py-8"
			title={t("title")}
		>
			<div className="my-auto flex w-full max-w-xl shrink-0 flex-col items-center gap-6">
				<Filter value={[RoleName.ORGANIZER]} method="some">
					<>
						<select
							disabled={isScanning}
							aria-label={t("scan-purpose")}
							className="ui-field w-full text-center"
							onChange={e => {
								selectedAction.current = e.target.value;
								prevHackerId.current = "";
								setDisplay(<></>);
								setError("");
							}}
						>
							{menuOptions.map(event => {
								return (
									<option key={event} value={event}>
										{t(event)}
									</option>
								);
							})}
						</select>
						<QRScanner onScan={onScan} setError={setError} />
						<PhysicalScanner onScan={onScan} />
						{!error && (
							<p className="z-10 max-w-xl text-center text-lg font-bold text-dark-color">
								{t("scan-qr")}
							</p>
						)}
					</>
					<>
						<Tabs names={["QR", "Scan"]}>
							<>
								<QRCode setError={setError} id={encryptedId} />
								{!error && (
									<p className="z-10 max-w-xl text-center text-lg font-bold text-dark-color">
										{t("use-qr")}
									</p>
								)}
							</>
							<QRScanner onScan={onScan} setError={setError} />
						</Tabs>
					</>
				</Filter>
				{isScanning && <p role="status">{t("recording-scan")}</p>}
				{display}
				{error && <Error message={error} />}
			</div>
		</App>
	);
};

const UnknownError = () => {
	const { t } = useTranslation("qr");

	return <Error message={t("unknown-error")} />;
};

const NotHackerError = () => {
	const { t } = useTranslation("qr");

	return <Error message={t("not-hacker")} />;
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const secretKey = env.QR_SECRET_KEY;
	const session = await getServerSession(req, res, getAuthOptions(req));

	const timestamp = Math.floor(Date.now() / 60000);
	const encryptedId = session?.user?.hackerId ? encrypt(`${session.user.hackerId}:${timestamp}`, secretKey) : null;

	return {
		redirect: await qrRedirect(session, "/qr"),
		props: {
			encryptedId,
			...(await serverSideTranslations(locale ?? "en", ["qr", "navbar", "common"])),
		},
	};
};

export default QR;
