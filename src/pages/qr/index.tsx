import { RoleName } from "@prisma/client";
import { TRPCClientError } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppRouter } from "../../server/api/root";

import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";
import PhysicalScanner from "../../components/PhysicalScanner";
import QRCode from "../../components/QRCode";
import QRScanner from "../../components/QRScanner";
import { trpc } from "../../server/api/api";
import { qrRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Hacker = RouterOutput["hackers"]["get"];
type Presence = RouterOutput["presence"]["getFromHackerId"][0];

const defaultAction = "Get Hacker";

const QR = () => {
	const { t, i18n } = useTranslation("qr");
	const router = useRouter();
	const [error, setError] = useState(false);

	const selectedAction = useRef<string>(defaultAction);
	const { data: events } = trpc.events.all.useQuery();

	const [menuOptions, setMenuOptions] = useState<string[]>([]);

	const prevHackerId = useRef<string>("");

	const { mutateAsync: presenceUpsertMutateAsync } = trpc.presence.upsert.useMutation();
	const { mutateAsync: presenceIncrementMutateAsync } = trpc.presence.increment.useMutation();

	const [display, setDisplay] = useState(<></>);

	const utils = trpc.useUtils();

	useEffect(() => {
		const now = new Date();

		const validEvents =
			events
				?.filter(event => event.end >= now)
				.filter((event, index, self) => self.findIndex(e => e.name === event.name) === index)
				.sort((a, b) => a.start.getTime() - b.start.getTime())
				.map(event => event.name) ?? [];

		setMenuOptions([defaultAction, ...validEvents]);
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
		async (hacker: Hacker, presences: Presence[]) => {
			const maxCheckIns = events?.find(event => event.name === selectedAction.current)?.maxCheckIns as
				| number
				| null;

			// If hacker has already checked-in -> Show RepeatedVisitor component with increment button
			for (const presence of presences) {
				if (presence.label != selectedAction.current) continue;
				return setDisplay(
					<RepeatedVisitor
						hacker={hacker}
						presence={presence}
						maxCheckIns={maxCheckIns}
						incrementFn={presenceIncrementMutateAsync}
					/>,
				);
			}

			try {
				await presenceUpsertMutateAsync({ hackerId: hacker.id, value: 1, label: selectedAction.current });
				return setDisplay(
					<FirstTimeVisitor
						hacker={hacker}
						event={selectedAction.current}
						upsertFn={presenceUpsertMutateAsync}
					/>,
				);
			} catch (error) {
				if (error instanceof TRPCClientError) {
					return setDisplay(<Error message={error.message} />);
				}
				return setDisplay(<UnknownError />);
			}
		},
		[events, presenceIncrementMutateAsync, presenceUpsertMutateAsync],
	);

	const handleScanResult = useCallback(
		async (hackerId: string) => {
			if (hackerId === prevHackerId.current) return;

			console.debug("hackerId changed", hackerId, "!=", prevHackerId.current);
			prevHackerId.current = hackerId;

			if (hackerId === "") return;

			if (selectedAction.current === defaultAction) {
				router.push(`/hackers/hacker?id=${hackerId}`);
			} else {
				try {
					const hacker = await utils.hackers.get.fetch({ id: hackerId });
					const presences = await utils.presence.getFromHackerId.fetch({ id: hackerId });
					await handleEvent(hacker, presences);
				} catch (error) {
					if (error instanceof TRPCClientError) {
						setDisplay(<Error message={error.message} />);
					}
					setDisplay(<UnknownError />);
				}
			}
		},
		[handleEvent, router, utils],
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
			className="relative flex h-full flex-col items-center justify-center gap-16 bg-default-gradient"
			title={t("title")}
		>
			<div className="flex flex-col items-center gap-6">
				<Filter value={[RoleName.ORGANIZER]} method="some">
					<>
						<select
							className="p-3 text-center text-lg font-bold text-dark-color"
							onChange={e => {
								selectedAction.current = e.target.value;
								prevHackerId.current = "";
								setDisplay(<></>);
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
						<QRScanner onScan={onScan} />
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
		</App>
	);
};

const UnknownError = () => {
	const { t } = useTranslation("qr");

	return <Error message={t("unknown-error")} />;
};

type FirstTimeVisitor = {
	hacker: Hacker;
	event: string;
	upsertFn: (params: { hackerId: string; value: number; label: string }) => Promise<void>;
};

const FirstTimeVisitor = ({ hacker, event }: FirstTimeVisitor) => {
	const { t } = useTranslation("qr");

	return (
		<div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-light-primary-color p-6 text-light-color">
			{t("checked-in", {
				firstName: hacker.firstName,
				lastName: hacker.lastName,
				event: event,
			})}
		</div>
	);
};

type RepeatedVisitor = {
	hacker: Hacker;
	presence: Presence;
	maxCheckIns: number | null;
	incrementFn: (params: { id: string; value: number }) => Promise<void>;
};

const RepeatedVisitor = ({ hacker, presence, maxCheckIns, incrementFn }: RepeatedVisitor) => {
	const { t } = useTranslation("qr");

	const [counter, setCounter] = useState(0);

	useEffect(() => {
		setCounter(presence.value);
	}, [presence]);

	const handleIncrement = async (value: number) => {
		setCounter(counter + value);
		try {
			await incrementFn({ id: presence.id, value });
		} catch (error) {
			if (error instanceof TRPCClientError) {
				return <Error message={error.message} />;
			}
			return <UnknownError />;
		}
	};

	return (
		<div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-light-primary-color p-6 text-light-color">
			<div>{t("already-checked-in", { firstName: hacker.firstName, lastName: hacker.lastName, counter })}</div>
			{!maxCheckIns || maxCheckIns > presence.value ? (
				<div className="flex w-full justify-center gap-16">
					<button
						className="z-10 w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
						onClick={() => void handleIncrement(-1)}
					>
						—
					</button>
					<button
						className="z-10 w-fit whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-dark-primary-color transition-colors hover:bg-light-tertiary-color"
						onClick={() => void handleIncrement(1)}
					>
						+
					</button>
				</div>
			) : (
				<Error
					message={t("max-check-ins-reached", {
						maxCheckIns,
						firstName: hacker.firstName,
						lastName: hacker.lastName,
					})}
				/>
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
