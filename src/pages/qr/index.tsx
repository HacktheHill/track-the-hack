import { RoleName, ScannerWorkflow, TShirtSize } from "@prisma/client";
import type { GetServerSideProps } from "next";
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
import type { RouterOutputs } from "@/server/api/api";
import { trpc } from "@/server/api/api";
import { rolesRedirect } from "@/server/lib/redirects";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";

type Hacker = RouterOutputs["hackers"]["get"];
type WorkflowScan = RouterOutputs["presence"]["scan"];
const VIEW_PARTICIPANT = "__view__";
const SELECTION_KEY = "track-scanner-station";

const QR = () => {
	const { t, i18n } = useTranslation("qr");
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
					const hacker = await utils.hackers.get.fetch({ id: hackerId });
					if (sequence !== scanSequence.current) return;
					setDisplay(<ParticipantCard hacker={hacker} />);
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
				<select
					aria-label={t("select-action")}
					disabled={pending}
					className="ui-field w-full max-w-4xl text-center"
					value={selectedValue}
					onChange={event => {
						if (operation.isPending()) return;
						scanSequence.current += 1;
						selectedAction.current = event.target.value;
						setSelectedValue(event.target.value);
						try {
							window.localStorage.setItem(SELECTION_KEY, event.target.value);
						} catch {
							// The selection still lasts for this page visit.
						}
						previousId.current = "";
						setDisplay(undefined);
						setError("");
					}}
				>
					<option value={VIEW_PARTICIPANT}>{t("view-participant")}</option>
					{events.map(event => (
						<option key={event.id} value={event.id}>
							{t(`workflow.${event.scannerWorkflow}`)} —{" "}
							{i18n.language === "fr" ? event.nameFr : event.name} —{" "}
							{event.start.toLocaleString(i18n.language === "fr" ? "fr-CA" : "en-CA", {
								weekday: "short",
								hour: "numeric",
								minute: "2-digit",
							})}
						</option>
					))}
				</select>
				<div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
					<QRScanner onScan={handleCameraScan} onClear={handleCameraClear} setError={setError} />
					<PhysicalScanner onScan={handlePhysicalScan} disabled={pending} />
				</div>
				{display}
				{error && <ErrorDisplay message={error} />}
			</div>
		</App>
	);
};

// Full operational lookup is deliberately separate from workflow scans. The
// latter never call this endpoint or receive this broader object.
const ParticipantCard = ({ hacker }: { hacker: Hacker }) => {
	const { t } = useTranslation("qr");

	return (
		<div className="rounded-lg bg-light-primary-color p-6 font-rubik text-light-color">
			<p className="break-all font-bold">{hacker.id}</p>
			<p>{t("confirmed", { value: hacker.confirmed ? t("yes") : t("no") })}</p>
			<TShirtInfo size={hacker.tShirtSize} />
			<MealInfo mealCategory={hacker.mealCategory} />
			{hacker.walkIn && <p>{t("walk-in")}</p>}
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
		{ eventId: result.eventId, hackerId: result.participant.id },
		{ enabled: result.workflow === ScannerWorkflow.ATTENDANCE },
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
				key={`${result.eventId}:${result.participant.id}`}
				eventId={result.eventId}
				hackerId={result.participant.id}
				eventName={i18n.language === "fr" ? result.nameFr : result.name}
				initialValue={result.value}
				initialAtLimit={result.atLimit}
				operation={operation}
			/>
		</ScanResult>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: await rolesRedirect(session, "/qr", [RoleName.ORGANIZER, RoleName.ADMIN]),
		props: await serverSideTranslations(locale ?? "en", ["qr", "navbar", "common", "event"]),
	};
};

export default QR;
