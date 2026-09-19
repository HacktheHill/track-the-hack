import { ScannerWorkflow, TShirtSize, type Event } from "@prisma/client";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { RouterOutputs } from "@/server/api/api";

type ScanResultProps = {
	result: RouterOutputs["presence"]["scan"];
	interestedEvents?: Pick<Event, "id" | "name" | "nameFr" | "start">[];
	children?: ReactNode;
};

export default function ScanResult({ result, interestedEvents, children }: ScanResultProps) {
	const { t, i18n } = useTranslation("qr");
	const french = i18n.language.startsWith("fr");
	return (
		<section
			aria-label={t("scan-result")}
			aria-live="polite"
			className="flex w-full max-w-xl flex-col gap-4 break-words rounded-lg bg-light-primary-color p-6 font-rubik text-light-color"
		>
			<h2 className="break-all font-coolvetica text-2xl">{result.participant.id}</h2>
			<p>{french ? result.nameFr : result.name}</p>
			{result.workflow === ScannerWorkflow.CHECK_IN && (
				<p>{t("confirmed", { value: result.participant.confirmed ? t("yes") : t("no") })}</p>
			)}
			{(result.workflow === ScannerWorkflow.CHECK_IN || result.workflow === ScannerWorkflow.MERCHANDISE) && (
				<p>
					{result.participant.tShirtSize === TShirtSize.NONE
						? t("common:no-t-shirt")
						: t("t-shirt", { value: result.participant.tShirtSize })}
				</p>
			)}
			{result.workflow === ScannerWorkflow.FOOD && (
				<>
					<p>{t("meal", { value: result.participant.mealCategory })}</p>
					{result.participant.requiresFoodLead && (
						<p className="rounded bg-light-quaternary-color p-3 font-bold text-dark-color">
							{t("contact-food-lead")}
						</p>
					)}
				</>
			)}
			{result.workflow === ScannerWorkflow.ATTENDANCE && (
				<div>
					<h3 className="font-bold">{t("events-of-interest")}</h3>
					{interestedEvents === undefined ? (
						<p role="status">{t("loading-interests")}</p>
					) : interestedEvents.length === 0 ? (
						<p>{t("no-event-interests")}</p>
					) : (
						<ul className="flex flex-col gap-3">
							{interestedEvents.map(event => (
								<li key={event.id}>
									<Link
										href={`/schedule/event?id=${encodeURIComponent(event.id)}`}
										className="underline underline-offset-2"
									>
										{french ? event.nameFr : event.name}
									</Link>
									<p className="text-sm">
										{event.start.toLocaleString(french ? "fr-CA" : "en-CA", {
											month: "short",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</p>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
			{children}
		</section>
	);
}
