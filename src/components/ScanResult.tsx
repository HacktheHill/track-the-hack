import { EventType, type Event, type Hacker } from "@prisma/client";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { useRef, useState } from "react";

type ScanResultProps = {
	hacker: Pick<Hacker, "firstName" | "lastName" | "tShirtSize" | "dietaryRestrictions">;
	event: Pick<Event, "name" | "nameFr" | "type" | "maxCheckIns">;
	initialCount: number;
	repeated: boolean;
	interestedEvents: Pick<Event, "id" | "name" | "nameFr" | "start">[];
	onIncrement?: (value: number) => Promise<void>;
};

export const isArrivalCheckIn = (name: string) => /^(arrival)?checkin$/.test(name.toLowerCase().replace(/[\s-]/g, ""));

export default function ScanResult({
	hacker,
	event,
	initialCount,
	repeated,
	interestedEvents,
	onIncrement,
}: ScanResultProps) {
	const { t, i18n } = useTranslation("qr");
	const [counter, setCounter] = useState(initialCount);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const pending = useRef(false);
	const isMeal = event.type === EventType.FOOD;
	const atLimit = event.maxCheckIns !== null && counter >= event.maxCheckIns;
	const eventName = i18n.language.startsWith("fr") ? event.nameFr : event.name;

	const adjustCount = async (value: number) => {
		if (!onIncrement || pending.current || counter + value < 0 || (value > 0 && atLimit)) return;
		pending.current = true;
		setSaving(true);
		setError("");
		try {
			await onIncrement(value);
			setCounter(current => current + value);
		} catch {
			setError(t("count-update-failed"));
		} finally {
			pending.current = false;
			setSaving(false);
		}
	};

	return (
		<section
			aria-label={t("scan-result")}
			aria-live="polite"
			className="flex w-full max-w-xl flex-col gap-4 break-words rounded-lg bg-light-primary-color p-6 text-light-color"
		>
			<div className="text-center">
				<h2 className="font-coolvetica text-2xl">
					{hacker.firstName} {hacker.lastName}
				</h2>
				<p>{eventName}</p>
			</div>
			{isMeal ? (
				<>
					<div className="text-center">
						<p className="font-bold">
							{t(
								counter <= 0
									? "meal-not-redeemed"
									: repeated
										? "meal-already-redeemed"
										: "meal-redeemed-now",
							)}
						</p>
						<p>{t("meal-redemption-count", { count: counter })}</p>
					</div>
					<dl className="border-t border-light-color/30 pt-4">
						<dt className="font-bold">{t("dietary-restrictions")}</dt>
						<dd className="whitespace-pre-wrap">
							{hacker.dietaryRestrictions?.trim() || t("not-provided")}
						</dd>
					</dl>
				</>
			) : (
				<p className="text-center">
					{t(repeated ? "already-checked-in" : "checked-in", { ...hacker, counter, event: eventName })}
				</p>
			)}
			{isArrivalCheckIn(event.name) && (
				<dl className="flex items-center justify-between gap-4 border-t border-light-color/30 pt-4">
					<dt className="font-bold">{t("t-shirt-size")}</dt>
					<dd className="font-coolvetica text-3xl">{hacker.tShirtSize || t("not-provided")}</dd>
				</dl>
			)}
			{!isMeal && !isArrivalCheckIn(event.name) && (
				<div className="border-t border-light-color/30 pt-4">
					<h3 className="mb-2 font-bold">{t("events-of-interest")}</h3>
					{interestedEvents.length === 0 ? (
						<p>{t("no-event-interests")}</p>
					) : (
						<ul className="flex flex-col gap-3">
							{interestedEvents.map(interest => (
								<li key={interest.id}>
									<Link
										href={`/schedule/event?id=${interest.id}`}
										className="underline underline-offset-2"
									>
										{i18n.language.startsWith("fr") ? interest.nameFr : interest.name}
									</Link>
									<p className="text-sm">
										{interest.start.toLocaleString(
											i18n.language.startsWith("fr") ? "fr-CA" : "en-CA",
											{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
										)}
									</p>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
			{repeated && onIncrement && (
				<>
					<div className="flex w-full flex-wrap justify-center gap-3">
						{[-1, 1].map(value => (
							<button
								key={value}
								type="button"
								aria-label={t(value < 0 ? "decrease-count" : "increase-count")}
								disabled={saving || (value < 0 ? counter <= 0 : atLimit)}
								aria-busy={saving}
								className="ui-button ui-button-icon z-10"
								onClick={() => void adjustCount(value)}
							>
								{value < 0 ? "—" : "+"}
							</button>
						))}
					</div>
					{atLimit && (
						<p className="text-center">
							{t("max-check-ins-reached", { ...hacker, maxCheckIns: event.maxCheckIns })}
						</p>
					)}
				</>
			)}
			{error && <p role="alert">{error}</p>}
		</section>
	);
}
