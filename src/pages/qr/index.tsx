import { ScannerWorkflow, TShirtSize } from "@prisma/client";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useCallback, useEffect, useRef, useState } from "react";
import { playScanFeedback } from "@/client/scan-feedback";
import PresenceCounter from "@/components/PresenceCounter";
import { useScannerOperation, type ScannerOperation } from "@/components/useScannerOperation";
import ScanResult, { MealInfo } from "@/components/ScanResult";
import ScannerResultStatus from "@/components/ScannerResultStatus";
import App from "@/components/App";
import ErrorDisplay from "@/components/Error";
import PhysicalScanner from "@/components/PhysicalScanner";
import QRScanner from "@/components/QRScanner";
import QRCode from "@/components/QRCode";
import type { RouterOutputs } from "@/server/api/api";
import { trpc } from "@/server/api/api";
import { organizerRedirect } from "@/server/lib/redirects";
import { createOrganizerPass, parseOrganizerPass } from "@/server/lib/organizer-pass";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

type Hacker = RouterOutputs["hackers"]["get"];
type WorkflowScan = RouterOutputs["presence"]["scan"];
const VIEW_PARTICIPANT = "__view__";
const SELECTION_KEY = "track-scanner-station";

const QR = ({ organizerPass }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
	const { t } = useTranslation("qr");
	const utils = trpc.useContext();
	const scannable = trpc.events.scannable.useQuery();
	const events = scannable.data ?? [];
	const { mutateAsync: scanPresence } = trpc.presence.scan.useMutation();
	const { operation, pending } = useScannerOperation();
	const selectedAction = useRef(VIEW_PARTICIPANT);
	const [selectedValue, setSelectedValue] = useState(VIEW_PARTICIPANT);
	const previousId = useRef("");
	const scanSequence = useRef(0);
	const [display, setDisplay] = useState<React.ReactNode>();
	const [error, setError] = useState("");
	const [tab, setTab] = useState<"pass" | "scan">("pass");

	useEffect(() => {
		if (!scannable.data) return;
		let saved: string | null = null;
		try {
			saved = window.localStorage.getItem(SELECTION_KEY);
		} catch {
			// The scanner still works when local storage is unavailable.
		}
		const next = saved && scannable.data.some(event => event.id === saved) ? saved : VIEW_PARTICIPANT;
		selectedAction.current = next;
		setSelectedValue(next);
	}, [scannable.data]);

	const scan = useCallback(
		async (rawId: string, suppressContinuousDuplicate: boolean) => {
			const hackerId = rawId.trim();
			if (!hackerId || (suppressContinuousDuplicate && hackerId === previousId.current) || !operation.begin())
				return;
			const sequence = ++scanSequence.current;
			previousId.current = hackerId;
			setDisplay(undefined);
			setError("");

			try {
				if (selectedAction.current === VIEW_PARTICIPANT) {
					const organizerId = parseOrganizerPass(hackerId);
					if (organizerId) {
						const organizer = await utils.users.getOrganizerPass.fetch({ id: organizerId });
						if (sequence !== scanSequence.current) return;
						setDisplay(<OrganizerCard organizer={organizer} />);
					} else {
						const hacker = await utils.hackers.get.fetch({ id: hackerId });
						if (sequence !== scanSequence.current) return;
						setDisplay(<ParticipantCard hacker={hacker} />);
					}
					playScanFeedback("view");
					return;
				}

				const result = await scanPresence({ eventId: selectedAction.current, hackerId });
				if (sequence !== scanSequence.current) return;
				setDisplay(<WorkflowCard result={result} operation={operation} />);
				playScanFeedback(result.outcome);
			} catch {
				if (sequence !== scanSequence.current) return;
				previousId.current = "";
				setDisplay(undefined);
				setError(t("unknown-error"));
				playScanFeedback("error");
			} finally {
				operation.end();
			}
		},
		[scanPresence, t, utils, operation],
	);
	const handleCameraScan = useCallback((result: string) => void scan(result, true), [scan]);
	const handleCameraClear = useCallback(() => {
		previousId.current = "";
	}, []);
	const handlePhysicalScan = useCallback((result: string) => void scan(result, false), [scan]);

	return (
		<App
			className="relative flex h-full flex-col items-center overflow-y-auto bg-default-gradient px-4 py-8"
			title={t("title")}
		>
			{/* Auto margins centre the column without making overflow unreachable above the scroll origin. */}
			<div className="my-auto flex w-full flex-col items-center gap-8">
				<div
					role="tablist"
					aria-label={t("tabs-label")}
					className="flex max-w-full rounded-xl bg-light-quaternary-color p-1"
				>
					<button
						type="button"
						role="tab"
						aria-selected={tab === "pass"}
						className="ui-button flex-1 border-transparent sm:px-6"
						onClick={() => setTab("pass")}
					>
						{t("my-pass")}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={tab === "scan"}
						className="ui-button flex-1 border-transparent sm:px-6"
						onClick={() => setTab("scan")}
					>
						{t("scan-passes")}
					</button>
				</div>
				{tab === "pass" ? (
					<section className="flex w-full max-w-xl flex-col items-center gap-4 rounded-xl bg-light-quaternary-color p-8 shadow-lg">
						<h1 className="text-center font-coolvetica text-3xl text-dark-color">{t("my-pass")}</h1>
						<QRCode value={organizerPass} label={t("organizer-qr-alt")} />
						<p className="text-center font-rubik text-sm text-dark-color">{t("organizer-pass-help")}</p>
					</section>
				) : (
					<ScannerPanel
						events={events}
						selectedValue={selectedValue}
						pending={pending}
						onSelection={value => {
							if (operation.isPending()) return;
							scanSequence.current += 1;
							selectedAction.current = value;
							setSelectedValue(value);
							try {
								window.localStorage.setItem(SELECTION_KEY, value);
							} catch {
								// The selection still lasts for this page visit.
							}
							previousId.current = "";
							setDisplay(undefined);
							setError("");
						}}
						onCameraScan={handleCameraScan}
						onCameraClear={handleCameraClear}
						onPhysicalScan={handlePhysicalScan}
						setError={setError}
					/>
				)}
				{tab === "scan" && display}
				{tab === "scan" && error && <ErrorDisplay message={error} />}
			</div>
		</App>
	);
};

type ScannerPanelProps = {
	events: RouterOutputs["events"]["scannable"];
	selectedValue: string;
	pending: boolean;
	onSelection: (value: string) => void;
	onCameraScan: (result: string) => void;
	onCameraClear: () => void;
	onPhysicalScan: (result: string) => void;
	setError: (value: string) => void;
};

const ScannerPanel = ({
	events,
	selectedValue,
	pending,
	onSelection,
	onCameraScan,
	onCameraClear,
	onPhysicalScan,
	setError,
}: ScannerPanelProps) => {
	const { t, i18n } = useTranslation("qr");
	return (
		<>
			<select
				aria-label={t("select-action")}
				disabled={pending}
				className="ui-field w-full max-w-xl text-center"
				value={selectedValue}
				onChange={event => onSelection(event.target.value)}
			>
				<option value={VIEW_PARTICIPANT}>{t("view-participant")}</option>
				{events.map(event => (
					<option key={event.id} value={event.id}>
						{t(`workflow.${event.scannerWorkflow}`)}: {i18n.language === "fr" ? event.nameFr : event.name},{" "}
						{event.start.toLocaleString(i18n.language === "fr" ? "fr-CA" : "en-CA", {
							weekday: "short",
							hour: "numeric",
							minute: "2-digit",
						})}
					</option>
				))}
			</select>
			<div className="flex w-full max-w-sm flex-col items-center gap-3">
				<QRScanner onScan={onCameraScan} onClear={onCameraClear} setError={setError} />
				<PhysicalScanner onScan={onPhysicalScan} disabled={pending} />
			</div>
		</>
	);
};

// Full operational lookup is deliberately separate from workflow scans. The
// latter never call this endpoint or receive this broader object.
const ParticipantCard = ({ hacker }: { hacker: Hacker }) => {
	const { t } = useTranslation("qr");

	return (
		<div className="ui-panel rounded-lg p-6 font-rubik text-dark-color">
			<p className="break-all font-bold">{hacker.id}</p>
			<p>{t("confirmed", { value: hacker.confirmed ? t("yes") : t("no") })}</p>
			<TShirtInfo size={hacker.tShirtSize} />
			<MealInfo mealCategory={hacker.mealCategory} />
			{hacker.walkIn && <p>{t("walk-in")}</p>}
		</div>
	);
};

const OrganizerCard = ({ organizer }: { organizer: { id: string; name: string | null } }) => {
	const { t } = useTranslation("qr");
	return (
		<div className="ui-panel rounded-lg p-6 font-rubik text-dark-color">
			<p className="font-bold">{t("organizer-pass", { name: organizer.name ?? t("organizer") })}</p>
		</div>
	);
};

const TShirtInfo = ({ size }: { size: TShirtSize }) => {
	const { t } = useTranslation("qr");
	return <p>{size === TShirtSize.NONE ? t("common:no-t-shirt") : t("t-shirt", { value: size })}</p>;
};

const WorkflowCard = ({ result, operation }: { result: WorkflowScan; operation: ScannerOperation }) => {
	const { t, i18n } = useTranslation("qr");
	const interests = trpc.presence.getEventInterests.useQuery(
		{ eventId: result.eventId, hackerId: result.subjectType === "participant" ? result.participant.id : "" },
		{ enabled: result.subjectType === "participant" && result.workflow === ScannerWorkflow.ATTENDANCE },
	);
	return (
		<ScanResult result={result} interestedEvents={interests.data}>
			<ScannerResultStatus outcome={result.outcome} />
			{result.workflow === ScannerWorkflow.ATTENDANCE && interests.isError && (
				<button type="button" className="ui-button" onClick={() => void interests.refetch()}>
					{t("event:retry-interest")}
				</button>
			)}
			<PresenceCounter
				key={`${result.eventId}:${result.subjectType === "participant" ? result.participant.id : result.organizer.id}`}
				eventId={result.eventId}
				hackerId={
					result.subjectType === "participant"
						? result.participant.id
						: createOrganizerPass(result.organizer.id)
				}
				eventName={i18n.language === "fr" ? result.nameFr : result.name}
				initialValue={result.value}
				initialAtLimit={result.atLimit}
				operation={operation}
			/>
		</ScanResult>
	);
};

export const getServerSideProps: GetServerSideProps<{ organizerPass: string }> = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	const redirect = organizerRedirect(session, "/qr");
	if (redirect) return { redirect };
	if (!session?.user) throw new Error("Organizer session disappeared after authorization");
	return {
		props: {
			organizerPass: createOrganizerPass(session.user.id),
			...(await serverSideTranslations(locale ?? "en", ["qr", "navbar", "common", "event"])),
		},
	};
};

export default QR;
