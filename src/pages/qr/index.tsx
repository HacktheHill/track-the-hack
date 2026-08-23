import { RoleName, ScannerWorkflow } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useCallback, useRef, useState } from "react";
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
	const scanPresence = trpc.presence.scan.useMutation();
	const selectedAction = useRef(VIEW_PARTICIPANT);
	const previousId = useRef("");
	const [display, setDisplay] = useState<React.ReactNode>();
	const [error, setError] = useState("");

	const scan = useCallback(
		async (rawId: string) => {
			const hackerId = rawId.trim();
			if (!hackerId || hackerId === previousId.current) return;
			previousId.current = hackerId;
			setError("");

			try {
				if (selectedAction.current === VIEW_PARTICIPANT) {
					const hacker = await utils.hackers.get.fetch({ id: hackerId });
					setDisplay(<ParticipantCard hacker={hacker} />);
					return;
				}

				const result = await scanPresence.mutateAsync({ eventId: selectedAction.current, hackerId });
				setDisplay(<WorkflowCard result={result} />);
			} catch {
				previousId.current = "";
				setDisplay(undefined);
				setError(t("unknown-error"));
			}
		},
		[scanPresence, t, utils],
	);

	return (
		<App
			className="relative flex h-full flex-col items-center justify-center gap-8 overflow-y-auto bg-default-gradient p-6"
			title={t("title")}
		>
			<select
				className="p-3 text-center text-lg font-bold text-dark-color"
				onChange={event => {
					selectedAction.current = event.target.value;
					previousId.current = "";
					setDisplay(undefined);
					setError("");
				}}
			>
				<option value={VIEW_PARTICIPANT}>{t("view-participant")}</option>
				{events.map(event => (
					<option key={event.id} value={event.id}>
						{t(`workflow.${event.scannerWorkflow}`)} — {i18n.language === "fr" ? event.nameFr : event.name}
					</option>
				))}
			</select>
			<div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
				<QRScanner onScan={result => void scan(result)} setError={setError} />
				<PhysicalScanner onScan={result => void scan(result)} />
			</div>
			{display}
			{error && <ErrorDisplay message={error} />}
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
			<p>{t("t-shirt", { value: hacker.tShirtSize })}</p>
			<p>{t("meal", { value: hacker.mealCategory })}</p>
			{hacker.walkIn && <p>{t("walk-in")}</p>}
		</div>
	);
};

const WorkflowCard = ({ result }: { result: WorkflowScan }) => {
	const { t, i18n } = useTranslation("qr");
	const eventName = i18n.language === "fr" ? result.nameFr : result.name;

	return (
		<div className="rounded-lg bg-light-primary-color p-6 font-rubik text-light-color">
			<p className="break-all font-bold">{result.participant.id}</p>
			{result.workflow === ScannerWorkflow.CHECK_IN && (
				<>
					<p>{t("confirmed", { value: result.participant.confirmed ? t("yes") : t("no") })}</p>
					<p>{t("t-shirt", { value: result.participant.tShirtSize })}</p>
				</>
			)}
			{result.workflow === ScannerWorkflow.MERCHANDISE && (
				<p>{t("t-shirt", { value: result.participant.tShirtSize })}</p>
			)}
			{result.workflow === ScannerWorkflow.FOOD && (
				<>
					<p>{t("meal", { value: result.participant.mealCategory })}</p>
					{result.participant.requiresFoodLead && (
						<p className="mt-3 rounded bg-light-quaternary-color p-3 font-bold text-dark-color">
							{t("contact-food-lead")}
						</p>
					)}
				</>
			)}
			<PresenceCounter
				key={`${result.eventId}:${result.participant.id}`}
				eventId={result.eventId}
				hackerId={result.participant.id}
				eventName={eventName}
				initialValue={result.value}
				initialAtLimit={result.atLimit}
			/>
		</div>
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

	const change = async (amount: -1 | 1) => {
		const next = await adjustPresence.mutateAsync({ eventId, hackerId, amount });
		setValue(next.value);
		setAtLimit(next.atLimit);
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
					disabled={value <= 0 || adjustPresence.isLoading}
					className="rounded bg-light-quaternary-color px-5 py-2 text-dark-color disabled:opacity-50"
					onClick={() => void change(-1)}
				>
					−
				</button>
				<button
					type="button"
					disabled={atLimit || adjustPresence.isLoading}
					className="rounded bg-light-quaternary-color px-5 py-2 text-dark-color disabled:opacity-50"
					onClick={() => void change(1)}
				>
					+
				</button>
			</div>
		</>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: await rolesRedirect(session, "/qr", [RoleName.ORGANIZER, RoleName.ADMIN]),
		props: await serverSideTranslations(locale ?? "en", ["qr", "navbar", "common"]),
	};
};

export default QR;
