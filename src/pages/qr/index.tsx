import { RoleName, type Presence } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useCallback, useMemo, useRef, useState } from "react";
import App from "../../components/App";
import ErrorDisplay from "../../components/Error";
import PhysicalScanner from "../../components/PhysicalScanner";
import QRScanner from "../../components/QRScanner";
import type { RouterOutputs } from "../../server/api/api";
import { trpc } from "../../server/api/api";
import { rolesRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";

type Hacker = RouterOutputs["hackers"]["get"];
const VIEW_PARTICIPANT = "__view__";

const QR = () => {
	const { t } = useTranslation("qr");
	const utils = trpc.useContext();
	const eventData = trpc.events.future.useQuery().data;
	const events = useMemo(() => eventData ?? [], [eventData]);
	const upsertPresence = trpc.presence.upsert.useMutation();
	const incrementPresence = trpc.presence.increment.useMutation();
	const selectedAction = useRef(VIEW_PARTICIPANT);
	const previousId = useRef("");
	const [display, setDisplay] = useState<React.ReactNode>();
	const [error, setError] = useState("");

	const scan = useCallback(
		async (rawId: string) => {
			const id = rawId.trim();
			if (!id || id === previousId.current) return;
			previousId.current = id;
			setError("");

			try {
				const hacker = await utils.hackers.get.fetch({ id });
				if (selectedAction.current === VIEW_PARTICIPANT) {
					setDisplay(<ParticipantCard hacker={hacker} />);
					return;
				}

				const event = events.find(candidate => candidate.id === selectedAction.current);
				if (!event) throw new Error("Event not found");
				const presences = await utils.presence.getFromHackerId.fetch({ id });
				const existing = presences.find(presence => presence.label === event.name);
				if (!existing) {
					await upsertPresence.mutateAsync({ hackerId: id, value: 1, label: event.name });
					setDisplay(<PresenceCard hacker={hacker} event={event.name} value={1} />);
					return;
				}

				setDisplay(
					<PresenceCounter
						hacker={hacker}
						presence={existing}
						maxCheckIns={event.maxCheckIns}
						increment={value => incrementPresence.mutateAsync({ id: existing.id, value })}
					/>,
				);
			} catch {
				setDisplay(undefined);
				setError(t("unknown-error"));
			}
		},
		[events, incrementPresence, t, upsertPresence, utils],
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
						{event.name}
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

const ParticipantCard = ({ hacker }: { hacker: Hacker }) => (
	<div className="rounded-lg bg-light-primary-color p-6 font-rubik text-light-color">
		<p className="break-all font-bold">{hacker.id}</p>
		<p>Confirmed: {hacker.confirmed ? "Yes" : "No"}</p>
		<p>T-shirt: {hacker.tShirtSize}</p>
		<p>Meal: {hacker.mealCategory}</p>
		{hacker.walkIn && <p>Walk-in</p>}
	</div>
);

const PresenceCard = ({ hacker, event, value }: { hacker: Hacker; event: string; value: number }) => (
	<div className="rounded-lg bg-light-primary-color p-6 font-rubik text-light-color">
		<ParticipantCard hacker={hacker} />
		<p className="mt-3 font-bold">
			{event}: {value}
		</p>
	</div>
);

const PresenceCounter = ({
	hacker,
	presence,
	maxCheckIns,
	increment,
}: {
	hacker: Hacker;
	presence: Presence;
	maxCheckIns: number | null;
	increment: (value: number) => Promise<unknown>;
}) => {
	const [value, setValue] = useState(presence.value);
	const change = async (amount: number) => {
		if (value + amount < 0 || (amount > 0 && maxCheckIns !== null && value >= maxCheckIns)) return;
		await increment(amount);
		setValue(current => current + amount);
	};

	return (
		<div className="rounded-lg bg-light-primary-color p-6 font-rubik text-light-color">
			<ParticipantCard hacker={hacker} />
			<p className="mt-3 font-bold">
				{presence.label}: {value}
			</p>
			<div className="mt-4 flex justify-center gap-8">
				<button
					type="button"
					className="rounded bg-light-quaternary-color px-5 py-2 text-dark-color"
					onClick={() => void change(-1)}
				>
					−
				</button>
				<button
					type="button"
					disabled={maxCheckIns !== null && value >= maxCheckIns}
					className="rounded bg-light-quaternary-color px-5 py-2 text-dark-color disabled:opacity-50"
					onClick={() => void change(1)}
				>
					+
				</button>
			</div>
		</div>
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
