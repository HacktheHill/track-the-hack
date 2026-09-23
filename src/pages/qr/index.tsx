import { RoleName, ScannerWorkflow, TShirtSize } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useCallback, useRef, useState } from "react";
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

const QR = () => {
	const { t, i18n } = useTranslation("qr");
	const utils = trpc.useContext();
	const events = trpc.events.scannable.useQuery().data ?? [];
	const { mutateAsync: scanPresence } = trpc.presence.scan.useMutation();
	const { operation, pending } = useScannerOperation();
	const selectedAction = useRef(VIEW_PARTICIPANT);
	const previousId = useRef("");
	const scanSequence = useRef(0);
	const [display, setDisplay] = useState<React.ReactNode>();
	const [error, setError] = useState("");

	const scan = useCallback(
		async (rawId: string) => {
			const hackerId = rawId.trim();
			if (!hackerId || hackerId === previousId.current || !operation.begin()) return;
			const sequence = ++scanSequence.current;
			previousId.current = hackerId;
			setDisplay(undefined);
			setError("");

			try {
				if (selectedAction.current === VIEW_PARTICIPANT) {
					const hacker = await utils.hackers.get.fetch({ id: hackerId });
					if (sequence !== scanSequence.current) return;
					setDisplay(<ParticipantCard hacker={hacker} />);
					return;
				}

				const result = await scanPresence({ eventId: selectedAction.current, hackerId });
				if (sequence !== scanSequence.current) return;
				setDisplay(<WorkflowCard result={result} operation={operation} />);
			} catch {
				if (sequence !== scanSequence.current) return;
				previousId.current = "";
				setDisplay(undefined);
				setError(t("unknown-error"));
			} finally {
				operation.end();
			}
		},
		[scanPresence, t, utils, operation],
	);
	const handleScan = useCallback((result: string) => void scan(result), [scan]);

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
					onChange={event => {
						if (operation.isPending()) return;
						scanSequence.current += 1;
						selectedAction.current = event.target.value;
						previousId.current = "";
						setDisplay(undefined);
						setError("");
					}}
				>
					<option value={VIEW_PARTICIPANT}>{t("view-participant")}</option>
					{events.map(event => (
						<option key={event.id} value={event.id}>
							{t(`workflow.${event.scannerWorkflow}`)} —{" "}
							{i18n.language === "fr" ? event.nameFr : event.name}
						</option>
					))}
				</select>
				<div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
					<QRScanner onScan={handleScan} setError={setError} />
					<PhysicalScanner onScan={handleScan} disabled={pending} />
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
			<ScannerResultStatus recordedNow={result.recordedNow} />
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
