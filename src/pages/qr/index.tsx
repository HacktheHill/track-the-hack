import { RoleName, ScannerWorkflow, TShirtSize } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useCallback, useRef, useState } from "react";
import ScanResult, { MealInfo } from "@/components/ScanResult";
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
	const selectedAction = useRef(VIEW_PARTICIPANT);
	const previousId = useRef("");
	const scanSequence = useRef(0);
	const [display, setDisplay] = useState<React.ReactNode>();
	const [error, setError] = useState("");

	const scan = useCallback(
		async (rawId: string) => {
			const hackerId = rawId.trim();
			if (!hackerId || hackerId === previousId.current) return;
			const sequence = ++scanSequence.current;
			previousId.current = hackerId;
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
				setDisplay(<WorkflowCard result={result} />);
			} catch {
				if (sequence !== scanSequence.current) return;
				previousId.current = "";
				setDisplay(undefined);
				setError(t("unknown-error"));
			}
		},
		[scanPresence, t, utils],
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
					className="ui-field w-full max-w-4xl text-center"
					onChange={event => {
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
					<PhysicalScanner onScan={handleScan} />
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

const WorkflowCard = ({ result }: { result: WorkflowScan }) => {
	const { t, i18n } = useTranslation("qr");
	const interests = trpc.presence.getEventInterests.useQuery(
		{ eventId: result.eventId, hackerId: result.participant.id },
		{ enabled: result.workflow === ScannerWorkflow.ATTENDANCE },
	);
	return (
		<ScanResult result={result} interestedEvents={interests.data}>
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
			/>
		</ScanResult>
	);
};

const PresenceCounter = ({
	eventId,
	hackerId,
	eventName,
	initialValue,
	initialAtLimit,
}: {
	eventId: string;
	hackerId: string;
	eventName: string;
	initialValue: number;
	initialAtLimit: boolean;
}) => {
	const { t } = useTranslation("qr");
	const adjustPresence = trpc.presence.adjust.useMutation();
	const [value, setValue] = useState(initialValue);
	const [atLimit, setAtLimit] = useState(initialAtLimit);
	const [error, setError] = useState("");

	const change = async (amount: -1 | 1) => {
		setError("");
		try {
			const next = await adjustPresence.mutateAsync({ eventId, hackerId, amount });
			setValue(next.value);
			setAtLimit(next.atLimit);
		} catch {
			setError(t("adjust-error"));
		}
	};

	return (
		<>
			<p className="mt-3 font-bold">
				{eventName}: {value}
			</p>
			{atLimit && <p className="mt-2">{t("maximum-reached")}</p>}
			<div className="mt-4 flex justify-center gap-8">
				<button
					type="button"
					aria-label={t("decrease-count")}
					disabled={value <= 0 || adjustPresence.isLoading}
					className="ui-button ui-button-icon"
					onClick={() => void change(-1)}
				>
					−
				</button>
				<button
					type="button"
					aria-label={t("increase-count")}
					disabled={atLimit || adjustPresence.isLoading}
					className="ui-button ui-button-icon"
					onClick={() => void change(1)}
				>
					+
				</button>
			</div>
			{error && <ErrorDisplay message={error} />}
		</>
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
