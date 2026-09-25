import type { GetServerSideProps, NextPage } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useEffect, useRef, useState } from "react";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";
import { trpc } from "@/server/api/api";
import { organizerRedirect } from "@/server/lib/redirects";
import { modalFocusTarget } from "@/utils/modal-focus";

type Confirmation =
	| { kind: "send"; cohortId: string; ordinal: number; body: string }
	| { kind: "retry"; announcementId: string }
	| null;

const Notifications: NextPage = () => {
	const { t } = useTranslation("internal");
	const query = trpc.notifications.overview.useQuery(undefined, { refetchInterval: 10_000 });
	const create = trpc.notifications.createCampaign.useMutation({ onSuccess: () => void query.refetch() });
	const regenerate = trpc.notifications.regenerateCampaign.useMutation({ onSuccess: () => void query.refetch() });
	const queue = trpc.notifications.queueAnnouncement.useMutation({
		onSuccess: () => {
			setSelectedCohortId(null);
			setMessage("");
			void query.refetch();
		},
	});
	const retry = trpc.notifications.retryAnnouncement.useMutation({ onSuccess: () => void query.refetch() });
	const archive = trpc.notifications.archiveCampaign.useMutation({ onSuccess: () => void query.refetch() });
	const [name, setName] = useState("");
	const [maximum, setMaximum] = useState("50");
	const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
	const [message, setMessage] = useState("");
	const [confirmation, setConfirmation] = useState<Confirmation>(null);
	const [error, setError] = useState("");
	const dialogRef = useRef<HTMLElement>(null);
	const pending = create.isLoading || regenerate.isLoading || queue.isLoading || retry.isLoading || archive.isLoading;
	const maximumCohortSize = maximum.trim() === "" ? null : Number(maximum);
	const maximumInvalid =
		maximumCohortSize !== null &&
		(!Number.isInteger(maximumCohortSize) || maximumCohortSize < 1 || maximumCohortSize > 500);

	useEffect(() => {
		if (!confirmation) return;
		const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const dialog = dialogRef.current;
		const focusableSelector =
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
		dialog?.querySelector<HTMLElement>("[data-notification-dialog-focus]")?.focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				setConfirmation(null);
				return;
			}
			if (event.key !== "Tab" || !dialog) return;
			const elements = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
			const target = modalFocusTarget(
				elements,
				document.activeElement instanceof HTMLElement ? document.activeElement : null,
				event.shiftKey,
			);
			if (target) {
				event.preventDefault();
				target.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			previouslyFocused?.focus();
		};
	}, [confirmation]);

	const run = async (operation: () => Promise<unknown>) => {
		setError("");
		try {
			await operation();
			setConfirmation(null);
		} catch {
			setError(t("notifications.action-error"));
		}
	};

	if (query.isLoading)
		return (
			<App className="overflow-y-auto bg-default-gradient" integrated title={t("notifications.title")}>
				<Loading />
			</App>
		);
	if (query.isError || !query.data)
		return (
			<App className="overflow-y-auto bg-default-gradient" integrated title={t("notifications.title")}>
				<Error message={t("common:temporarily-unavailable")} />
			</App>
		);
	const confirmationCohort =
		confirmation?.kind === "send"
			? query.data.campaigns
					.flatMap(campaign => campaign.cohorts)
					.find(cohort => cohort.id === confirmation.cohortId)
			: undefined;

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated title={t("notifications.title")}>
			<main className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-8">
				<header>
					<h1 className="ui-page-title">{t("notifications.title")}</h1>
					<p className="font-rubik text-dark-color">
						{t("notifications.checked-in", {
							count: query.data.currentCheckedIn,
							dietary: query.data.currentDietaryPriority,
						})}
					</p>
					{!query.data.discordStatusAvailable && (
						<p role="alert" className="font-rubik text-dark-color">
							{t("notifications.discord-unavailable")}
						</p>
					)}
				</header>

				<section className="rounded-xl bg-light-quaternary-color p-6 shadow-lg">
					<h2 className="font-coolvetica text-2xl text-dark-color">{t("notifications.new-campaign")}</h2>
					<div className="mt-4 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
						<label className="ui-field">
							<span>{t("notifications.campaign-name")}</span>
							<input value={name} maxLength={191} onChange={event => setName(event.target.value)} />
						</label>
						<label className="ui-field">
							<span>{t("notifications.maximum-size")}</span>
							<input
								aria-describedby="notification-maximum-help"
								type="number"
								min={1}
								max={500}
								value={maximum}
								onChange={event => setMaximum(event.target.value)}
							/>
							<span id="notification-maximum-help" className="text-sm font-normal">
								{t("notifications.maximum-size-help")}
							</span>
						</label>
						<button
							type="button"
							className="ui-button ui-button-primary"
							disabled={pending || !name.trim() || maximumInvalid}
							onClick={() => void run(() => create.mutateAsync({ name, maximumCohortSize }))}
						>
							{t("notifications.generate")}
						</button>
					</div>
				</section>

				{query.data.campaigns.map(campaign => (
					<section key={campaign.id} className="rounded-xl bg-light-quaternary-color p-6 shadow-lg">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h2 className="font-coolvetica text-2xl text-dark-color">{campaign.name}</h2>
								<p className="font-rubik text-sm text-dark-color">
									{t("notifications.snapshot", {
										count: campaign.snapshotCount,
										date: campaign.snapshotAt.toLocaleString(),
									})}
								</p>
								<p className="font-rubik text-sm text-dark-color">
									{campaign.maximumCohortSize === null
										? t("notifications.cohort-mode-all")
										: t("notifications.cohort-mode-sized", {
												count: campaign.maximumCohortSize,
											})}
								</p>
							</div>
							<div className="flex gap-2">
								{campaign.status === "DRAFT" && (
									<button
										type="button"
										className="ui-button"
										disabled={pending}
										onClick={() =>
											void run(() =>
												regenerate.mutateAsync({
													id: campaign.id,
													name: campaign.name,
													maximumCohortSize: campaign.maximumCohortSize,
												}),
											)
										}
									>
										{t("notifications.regenerate")}
									</button>
								)}
								{campaign.status === "COMPLETED" && (
									<button
										type="button"
										className="ui-button"
										disabled={pending}
										onClick={() => void run(() => archive.mutateAsync({ id: campaign.id }))}
									>
										{t("notifications.archive")}
									</button>
								)}
							</div>
						</div>
						{campaign.lateCheckIns > 0 && (
							<p role="status" className="mt-3 font-rubik text-dark-color">
								{t("notifications.late-check-ins", { count: campaign.lateCheckIns })}
							</p>
						)}
						<div className="mt-5 grid gap-4">
							{campaign.cohorts.map(cohort => {
								const selected = selectedCohortId === cohort.id;
								const retryable = cohort.retryableDeliveries > 0;
								const announcementId = cohort.announcementId;
								const deliveryState = !announcementId
									? "unsent"
									: cohort.deliveryCounts.SENDING > 0
										? "sending"
										: cohort.deliveryCounts.PENDING > 0
											? "queued"
											: cohort.deliveryCounts.FAILED > 0
												? "partially-failed"
												: "complete";
								return (
									<article
										key={cohort.id}
										className="rounded-lg border border-dark-primary-color p-4"
									>
										<h3 className="font-coolvetica text-xl text-dark-color">
											{t("notifications.cohort", { number: cohort.ordinal, count: cohort.size })}
										</h3>
										<p className="font-rubik text-sm font-bold text-dark-color">
											{t(`notifications.status.${deliveryState}`)}
										</p>
										<p className="font-rubik text-sm text-dark-color">
											{t("notifications.eligibility", {
												dietary: cohort.dietaryPriority,
												push: cohort.pushEligible,
												discord: cohort.discordEligible ?? "?",
												dual: cohort.dualEligible ?? "?",
												unreachable: cohort.unreachable ?? "?",
											})}
										</p>
										{announcementId ? (
											<div className="mt-3 grid gap-2 font-rubik text-dark-color">
												<p>{cohort.body}</p>
												<p>{t("notifications.delivery-status", cohort.deliveryCounts)}</p>
												{cohort.uncertainDeliveries > 0 && (
													<p role="alert">
														{t("notifications.uncertain", {
															count: cohort.uncertainDeliveries,
														})}
													</p>
												)}
												{retryable && (
													<button
														type="button"
														className="ui-button justify-self-start"
														disabled={pending}
														onClick={() =>
															setConfirmation({
																kind: "retry",
																announcementId,
															})
														}
													>
														{t("notifications.retry")}
													</button>
												)}
											</div>
										) : selected ? (
											<div className="mt-3 grid gap-3">
												<label className="ui-field">
													<span>{t("notifications.message")}</span>
													<textarea
														rows={4}
														maxLength={500}
														value={message}
														onChange={event => setMessage(event.target.value)}
													/>
												</label>
												<span className="font-rubik text-sm text-dark-color">
													{message.length}/500
												</span>
												<button
													type="button"
													className="ui-button ui-button-primary justify-self-start"
													disabled={pending || !message.trim()}
													onClick={() =>
														setConfirmation({
															kind: "send",
															cohortId: cohort.id,
															ordinal: cohort.ordinal,
															body: message,
														})
													}
												>
													{t("notifications.preview")}
												</button>
											</div>
										) : (
											<button
												type="button"
												className="ui-button mt-3 justify-self-start"
												disabled={pending}
												onClick={() => {
													setSelectedCohortId(cohort.id);
													setMessage("");
												}}
											>
												{t("notifications.draft")}
											</button>
										)}
									</article>
								);
							})}
						</div>
					</section>
				))}

				{confirmation && (
					<section
						ref={dialogRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby="notification-confirm-title"
						className="fixed inset-0 z-50 grid place-items-center bg-dark-color/60 p-4"
					>
						<div className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-6 shadow-lg">
							<h2 id="notification-confirm-title" className="font-coolvetica text-2xl text-dark-color">
								{confirmation.kind === "send"
									? t("notifications.confirm-send", { number: confirmation.ordinal })
									: t("notifications.confirm-retry")}
							</h2>
							{confirmation.kind === "send" && (
								<>
									{confirmationCohort && (
										<p className="mt-4 font-rubik text-dark-color">
											{t("notifications.preview-counts", {
												hackers: confirmationCohort.size,
												push: confirmationCohort.pushEligible,
												discord: confirmationCohort.discordEligible ?? "?",
												unreachable: confirmationCohort.unreachable ?? "?",
											})}
										</p>
									)}
									<p className="mt-4 whitespace-pre-wrap font-rubik text-dark-color">
										{confirmation.body}
									</p>
								</>
							)}
							<div className="mt-6 flex justify-end gap-3">
								<button
									type="button"
									className="ui-button"
									data-notification-dialog-focus
									onClick={() => setConfirmation(null)}
								>
									{t("notifications.cancel")}
								</button>
								<button
									type="button"
									className="ui-button ui-button-primary"
									disabled={pending}
									onClick={() =>
										void run(() =>
											confirmation.kind === "send"
												? queue.mutateAsync({
														cohortId: confirmation.cohortId,
														body: confirmation.body,
													})
												: retry.mutateAsync({ announcementId: confirmation.announcementId }),
										)
									}
								>
									{t("notifications.confirm")}
								</button>
							</div>
						</div>
					</section>
				)}
				{error && (
					<p role="alert" className="font-rubik text-dark-color">
						{error}
					</p>
				)}
			</main>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/"),
		props: await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"]),
	};
};

export default Notifications;
