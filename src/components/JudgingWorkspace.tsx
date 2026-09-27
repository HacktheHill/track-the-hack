import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import App from "@/components/App";
import Error from "@/components/Error";
import JudgingProjectSwitchButton from "@/components/JudgingProjectSwitchButton";
import Loading from "@/components/Loading";
import {
	clearOfflineJudgingData,
	listJudgingOutbox,
	loadJudgingSnapshot,
	queueAssignmentPatch,
	removeJudgingOutboxEntries,
	saveJudgingSnapshot,
	type JudgingManifest,
	type OfflineJudgingPatch,
} from "@/client/judging-offline";
import { chunkJudgingOutbox as createSyncBatches } from "@/client/judging-offline-state";
import {
	getJudgingProjectStatus,
	isJudgingAssignmentStarted,
	shouldShowJudgingAssignment,
	shouldShowJudgingSyncButton,
} from "@/client/judging-status";
import {
	JUDGING_CATEGORY_CATALOG,
	MAIN_RUBRIC,
	SCORE_LEVEL_LABELS,
	isJudgingCategoryCode,
	mainScoreTotal,
	pointsForLevel,
	type MainRubricKey,
} from "@/shared/judging";
import { trpc } from "@/server/api/api";

type Assignment = JudgingManifest["judge"]["assignments"][number];
type AssignmentPatch = Partial<
	Pick<
		Assignment,
		| "technicalLevel"
		| "ideaLevel"
		| "designLevel"
		| "learningLevel"
		| "presentationLevel"
		| "miniEligibility"
		| "miniScore"
		| "note"
		| "rulesConcern"
		| "recusalReason"
	>
>;

const categoryDefinition = (code: string) => (isJudgingCategoryCode(code) ? JUDGING_CATEGORY_CATALOG[code] : undefined);

const assignmentResolution = (assignment: Assignment) =>
	assignment.project.categories.find(category => category.code === assignment.categoryCode)?.eligibilityResolution;

const assignmentComplete = (assignment: Assignment) => {
	if (assignment.recusedAt) return Boolean(assignment.recusalAcceptedAt);
	if (assignment.isMain)
		return [
			assignment.technicalLevel,
			assignment.ideaLevel,
			assignment.designLevel,
			assignment.learningLevel,
			assignment.presentationLevel,
		].every(value => value !== null);
	if (assignmentResolution(assignment) === "ELIGIBLE") return assignment.miniScore !== null;
	if (assignmentResolution(assignment) === "INELIGIBLE") {
		if (!assignment.miniEligibility) return false;
		return assignment.miniEligibility === "ELIGIBLE" || Boolean(assignment.note?.trim());
	}
	if (!assignment.miniEligibility) return false;
	if (assignment.miniEligibility === "ELIGIBLE") return assignment.miniScore !== null;
	return Boolean(assignment.note?.trim());
};

const localDate = (value: string | Date, locale: string) =>
	new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const hydrateManifestWithOutbox = (manifest: JudgingManifest, entries: OfflineJudgingPatch[]) => {
	const assignmentById = new Map(manifest.judge.assignments.map(assignment => [assignment.id, assignment]));
	type AssignmentEntry = Extract<OfflineJudgingPatch, { kind: "assignment" }>;
	const projectRecusals = new Map<string, AssignmentEntry>();
	for (const entry of entries) {
		if (entry.kind !== "assignment" || !("recusalReason" in entry.values)) continue;
		const projectId = assignmentById.get(entry.assignmentId)?.project.id;
		if (!projectId) continue;
		const existing = projectRecusals.get(projectId);
		if (!existing || entry.editedAt > existing.editedAt) projectRecusals.set(projectId, entry);
	}
	return {
		...manifest,
		judge: {
			...manifest.judge,
			assignments: manifest.judge.assignments.map(assignment => {
				const direct = entries.find(
					(entry): entry is AssignmentEntry =>
						entry.kind === "assignment" && entry.assignmentId === assignment.id,
				);
				const projectRecusal = projectRecusals.get(assignment.project.id);
				const values = {
					...(direct?.values ?? {}),
					...(projectRecusal ? { recusalReason: projectRecusal.values.recusalReason } : {}),
				};
				if (!direct && !projectRecusal) return assignment;
				// IndexedDB values were produced only by the typed assignment controls.
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				return {
					...assignment,
					...values,
					recusedAt:
						"recusalReason" in values
							? values.recusalReason
								? new Date(projectRecusal?.editedAt ?? direct?.editedAt ?? new Date())
								: null
							: assignment.recusedAt,
					recusalAcceptedAt: "recusalReason" in values ? null : assignment.recusalAcceptedAt,
				} as Assignment;
			}),
		},
	};
};

export default function JudgingWorkspace() {
	const { t, i18n } = useTranslation("judging");
	const router = useRouter();
	const locale = i18n.language.startsWith("fr") ? "fr" : "en";
	const [manifest, setManifest] = useState<JudgingManifest | null>(null);
	const [preparedAt, setPreparedAt] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(true);
	const [outboxCount, setOutboxCount] = useState(0);
	const [localAssignmentIds, setLocalAssignmentIds] = useState<Set<string>>(new Set());
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [syncState, setSyncState] = useState<
		"synced" | "offline" | "syncing" | "failed" | "locked" | "discarded" | "outdated" | "updated"
	>("synced");
	const [recusalDrafts, setRecusalDrafts] = useState<Record<string, string>>({});
	const syncInFlight = useRef<Promise<void> | null>(null);
	const syncRequestedWhileBusy = useRef(false);

	const refreshOutbox = useCallback(async () => {
		const entries = await listJudgingOutbox();
		setOutboxCount(entries.length);
		setLocalAssignmentIds(
			new Set(entries.filter(entry => entry.kind === "assignment").map(entry => entry.assignmentId)),
		);
		return entries;
	}, []);

	const applyManifest = useCallback(
		async (next: JudgingManifest) => {
			const snapshot = await saveJudgingSnapshot(next);
			setPreparedAt(snapshot.preparedAt);
			const entries = await refreshOutbox();
			const hydrated = hydrateManifestWithOutbox(next, entries);
			if (next.judge.round.state === "LOCKED" && entries.length === 0) await clearOfflineJudgingData();
			setManifest(hydrated);
			if (!selectedProjectId) setSelectedProjectId(hydrated.judge.assignments[0]?.project.id ?? null);
		},
		[refreshOutbox, selectedProjectId],
	);

	const manifestQuery = trpc.judging.manifest.useQuery(undefined, {
		retry: false,
		onSuccess: data => void applyManifest(data),
	});
	const syncMutation = trpc.judging.sync.useMutation();

	const sync = useCallback(async () => {
		if (syncInFlight.current) {
			syncRequestedWhileBusy.current = true;
			return syncInFlight.current;
		}
		const run = (async () => {
			if (!manifest || !navigator.onLine) {
				setSyncState("offline");
				return;
			}
			const entries = await refreshOutbox();
			if (!entries.length) {
				setSyncState("synced");
				return;
			}
			setSyncState("syncing");
			try {
				let discardedCount = 0;
				let outdatedRankingCount = 0;
				let supersededFieldCount = 0;
				let authoritativeManifest = manifest;
				for (const { assignments: assignmentBatch, rankings: rankingBatch } of createSyncBatches(entries)) {
					const result = await syncMutation.mutateAsync({
						roundId: manifest.judge.round.id,
						assignmentVersion: Math.min(
							...[
								...assignmentBatch.map(entry => entry.assignmentVersion),
								...rankingBatch.map(entry => entry.assignmentVersion),
							].filter((value): value is number => value !== undefined),
							manifest.judge.round.assignmentVersion,
						),
						assignments: assignmentBatch.map(entry => ({
							operationId: entry.operationId,
							assignmentId: entry.assignmentId,
							editedAt: entry.editedAt,
							fieldEditedAt: entry.fieldEditedAt,
							fieldOperationIds: entry.fieldOperationIds,
							values: entry.values,
						})),
						rankings: rankingBatch.map(entry => ({
							operationId: entry.operationId,
							categoryCode: entry.categoryCode,
							projectIds: entry.projectIds,
							editedAt: entry.editedAt,
						})),
					});
					if (result.locked) {
						setSyncState("locked");
						return;
					}
					await removeJudgingOutboxEntries([...result.applied, ...result.discarded]);
					discardedCount += result.discarded.length;
					outdatedRankingCount += result.outdatedRankings.length;
					supersededFieldCount += result.supersededFields.length;
					authoritativeManifest = result.manifest;
				}
				await applyManifest(authoritativeManifest);
				await refreshOutbox();
				setSyncState(
					outdatedRankingCount
						? "outdated"
						: discardedCount
							? "discarded"
							: supersededFieldCount
								? "updated"
								: "synced",
				);
			} catch {
				setSyncState("failed");
			}
		})();
		syncInFlight.current = run;
		try {
			await run;
		} finally {
			if (syncInFlight.current === run) syncInFlight.current = null;
			if (syncRequestedWhileBusy.current) {
				syncRequestedWhileBusy.current = false;
				window.setTimeout(() => void sync(), 0);
			}
		}
	}, [applyManifest, manifest, refreshOutbox, syncMutation]);

	useEffect(() => {
		if (isOnline) return;
		void loadJudgingSnapshot().then(snapshot => {
			if (!snapshot || manifest) return;
			void listJudgingOutbox().then(entries => {
				const hydrated = hydrateManifestWithOutbox(snapshot.manifest, entries);
				setPreparedAt(snapshot.preparedAt);
				setManifest(hydrated);
				setSelectedProjectId(hydrated.judge.assignments[0]?.project.id ?? null);
				setSyncState(typeof navigator !== "undefined" && navigator.onLine ? "failed" : "offline");
			});
		});
		void refreshOutbox();
	}, [isOnline, manifest, refreshOutbox]);

	useEffect(() => {
		setIsOnline(navigator.onLine);
		const online = () => {
			setIsOnline(true);
			void sync();
		};
		const offline = () => {
			setIsOnline(false);
			setSyncState("offline");
		};
		const focus = () => navigator.onLine && void sync();
		window.addEventListener("online", online);
		window.addEventListener("offline", offline);
		window.addEventListener("focus", focus);
		return () => {
			window.removeEventListener("online", online);
			window.removeEventListener("offline", offline);
			window.removeEventListener("focus", focus);
		};
	}, [sync]);

	useEffect(() => {
		const retry = window.setInterval(() => {
			if (navigator.onLine) void sync();
		}, 15_000);
		return () => window.clearInterval(retry);
	}, [sync]);

	const assignments = useMemo(() => manifest?.judge.assignments ?? [], [manifest]);
	const visibleAssignments = useMemo(
		() =>
			assignments.filter(assignment =>
				shouldShowJudgingAssignment({
					complete: assignmentComplete(assignment),
					localOnly: localAssignmentIds.has(assignment.id),
				}),
			),
		[assignments, localAssignmentIds],
	);
	const projects = useMemo(() => {
		const unique = new Map<string, Assignment["project"]>();
		for (const assignment of visibleAssignments) unique.set(assignment.project.id, assignment.project);
		return [...unique.values()].sort((a, b) => a.room.localeCompare(b.room) || a.tableNumber - b.tableNumber);
	}, [visibleAssignments]);
	const selectedProject = projects.find(project => project.id === selectedProjectId) ?? projects[0];
	const selectedAssignments = visibleAssignments.filter(
		assignment => assignment.project.id === selectedProject?.id,
	);
	const selectedRecusal = selectedAssignments.find(assignment => assignment.recusedAt);
	const selectedRecusalAnchor = selectedAssignments[0];

	const queueChange = useCallback(
		async (assignmentId: string, values: AssignmentPatch) => {
			await queueAssignmentPatch(assignmentId, values);
			setManifest(current =>
				current
					? {
							...current,
							judge: {
								...current.judge,
								assignments: current.judge.assignments.map(assignment => {
									const source = current.judge.assignments.find(item => item.id === assignmentId);
									const projectWideRecusal =
										"recusalReason" in values && assignment.project.id === source?.project.id;
									return assignment.id === assignmentId || projectWideRecusal
										? {
												...assignment,
												...(assignment.id === assignmentId ? values : {}),
												...(projectWideRecusal ? { recusalReason: values.recusalReason } : {}),
												recusedAt: projectWideRecusal
													? values.recusalReason
														? new Date()
														: null
													: assignment.recusedAt,
												recusalAcceptedAt: projectWideRecusal
													? null
													: assignment.recusalAcceptedAt,
											}
										: assignment;
								}),
							},
						}
					: current,
			);
			await refreshOutbox();
			setSyncState(navigator.onLine ? "syncing" : "offline");
			if (navigator.onLine) window.setTimeout(() => void sync(), 0);
		},
		[refreshOutbox, sync],
	);

	const queueProjectRecusal = useCallback(async () => {
		if (!selectedProject || !selectedRecusalAnchor) return;
		const reason = recusalDrafts[selectedProject.id]?.trim();
		if (!reason) return;
		await queueChange(selectedRecusalAnchor.id, { recusalReason: reason });
	}, [queueChange, recusalDrafts, selectedProject, selectedRecusalAnchor]);

	if (!manifest) {
		return (
			<App className="overflow-y-auto bg-default-gradient" integrated title={t("title")}>
				<div className="ui-form-layout mx-auto flex max-w-2xl flex-col items-center gap-5 p-6 text-center">
					<h1 className="ui-page-title">{t("title")}</h1>
					{!isOnline ? (
						<Error message={t("offline-unavailable")} />
					) : manifestQuery.isLoading ? (
						<Loading />
					) : (
						<>
							<p>{t("sign-in-required")}</p>
							<Link
								href={`/api/auth/signin?callbackUrl=${encodeURIComponent(router.asPath)}`}
								className="ui-button ui-button-primary"
							>
								{t("sign-in")}
							</Link>
						</>
					)}
				</div>
			</App>
		);
	}

	const bannerKey = syncState === "synced" && outboxCount ? "failed" : syncState;
	const showSyncButton = shouldShowJudgingSyncButton({ isOnline, outboxCount, syncState: bannerKey });
	return (
		<App className="overflow-y-auto bg-default-gradient" integrated title={t("title")}>
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 pb-24 sm:p-6">
				<h1 className="ui-page-title text-center">{t("title")}</h1>
				<div
					className={`ui-panel sticky top-2 z-20 flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${bannerKey === "synced" ? "bg-green-50" : "bg-amber-50"}`}
					role="status"
				>
					<span className="flex-1 font-rubik font-medium">
						{t(`sync.${bannerKey}`, { count: outboxCount })}
					</span>
					{showSyncButton && (
						<button
							type="button"
							className="ui-button"
							disabled={syncState === "syncing"}
							onClick={() => void sync()}
						>
							{t("sync.now")}
						</button>
					)}
					<button
						type="button"
						className="ui-button"
						onClick={() => void clearOfflineJudgingData().then(() => location.reload())}
					>
						{t("sync.clear")}
					</button>
				</div>
				{preparedAt && (
					<p className="text-center text-sm">{t("sync.prepared", { date: localDate(preparedAt, locale) })}</p>
				)}
				<p className="ui-panel p-3 text-sm">{t("shared-device")}</p>

				<div className="flex gap-2 overflow-x-auto pb-2" aria-label={t("title")}>
					{projects.map(project => {
						const projectAssignments = visibleAssignments.filter(
							assignment => assignment.project.id === project.id,
						);
						const complete = projectAssignments.every(assignmentComplete);
						const completedAssignments = projectAssignments.filter(assignmentComplete).length;
						const localOnly = projectAssignments.some(assignment => localAssignmentIds.has(assignment.id));
						const allRecused = projectAssignments.every(assignment => assignment.recusedAt);
						const allRecusalsAccepted = projectAssignments.every(
							assignment => assignment.recusalAcceptedAt,
						);
						const hasPendingRecusal = projectAssignments.some(
							assignment => assignment.recusedAt && !assignment.recusalAcceptedAt,
						);
						const hasUnresolvedEligibility = projectAssignments.some(
							assignment => assignment.miniEligibility === "UNSURE" && !assignmentResolution(assignment),
						);
						const status = getJudgingProjectStatus({
							localOnly,
							complete,
							allRecused,
							allRecusalsAccepted,
							hasPendingRecusal,
							hasUnresolvedEligibility,
							started: projectAssignments.some(isJudgingAssignmentStarted),
						});
						const completionLabel = allRecused
							? t(`status.${status}`)
							: complete
								? t(localOnly ? "progress.complete-local" : "progress.complete")
							: t("progress.count", {
									complete: completedAssignments,
									total: projectAssignments.length,
								});
						return (
							<JudgingProjectSwitchButton
								key={project.id}
								completionLabel={completionLabel}
								isComplete={complete}
								isLocalOnly={localOnly}
								isSelected={project.id === selectedProject?.id}
								onSelect={() => setSelectedProjectId(project.id)}
								projectName={project.name}
								statusLabel={t(`status.${status}`)}
								tableLabel={t("table", { number: project.tableNumber })}
							/>
						);
					})}
				</div>

				{selectedProject && (
					<section className="ui-panel flex flex-col gap-5 p-5">
						<div>
							<p className="font-rubik text-sm font-bold uppercase tracking-wide">
								{t("table", { number: selectedProject.tableNumber })} · {selectedProject.room}
							</p>
							<h2 className="text-2xl font-bold">{selectedProject.name}</h2>
							<a
								className="text-highlight-color underline"
								href={selectedProject.devpostUrl}
								target="_blank"
								rel="noreferrer"
							>
								{t("open-devpost")}
							</a>
						</div>
						{selectedProject.mainTrack === "CGI" && (
							<div
								className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950"
								role="status"
							>
								<p className="font-bold">{t("cgi-main-track-title")}</p>
								<p className="mt-1 text-sm">{t("cgi-main-track-notice")}</p>
							</div>
						)}
						<div className="rounded-xl border-2 border-dark-primary-color/20 bg-white p-4">
							{selectedRecusal ? (
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<strong>
											{t(
												selectedRecusal.recusalAcceptedAt
													? "status.recusal-accepted"
													: "status.recusal-requested",
											)}
										</strong>
										<p className="mt-1 text-sm">{selectedRecusal.recusalReason}</p>
									</div>
									{selectedRecusalAnchor && localAssignmentIds.has(selectedRecusalAnchor.id) && (
										<button
											type="button"
											className="ui-button"
											onClick={() =>
												void queueChange(selectedRecusalAnchor.id, { recusalReason: null })
											}
										>
											{t("undo-recusal")}
										</button>
									)}
								</div>
							) : (
								<div className="flex flex-col gap-3">
									<div>
										<strong>{t("recusal")}</strong>
										<p className="mt-1 text-sm">{t("recusal-project-help")}</p>
									</div>
									<label className="block font-bold">
										{t("recusal-reason")}
										<input
											className="ui-field mt-2 w-full"
											value={recusalDrafts[selectedProject.id] ?? ""}
											onChange={event =>
												setRecusalDrafts(current => ({
													...current,
													[selectedProject.id]: event.target.value,
												}))
											}
										/>
									</label>
									<button
										type="button"
										className="ui-button self-start"
										disabled={!recusalDrafts[selectedProject.id]?.trim()}
										onClick={() => void queueProjectRecusal()}
									>
										{t("recusal")}
									</button>
								</div>
							)}
						</div>
						{!selectedRecusal &&
							selectedAssignments.map(assignment => {
								const category = categoryDefinition(assignment.categoryCode);
								const eligibilityResolution = assignmentResolution(assignment);
								const requiresResolvedEligibleScore =
									!assignment.isMain &&
									eligibilityResolution === "ELIGIBLE" &&
									assignment.miniEligibility !== "ELIGIBLE";
								const levels: Partial<Record<MainRubricKey, number>> = {
									technicalLevel: assignment.technicalLevel ?? undefined,
									ideaLevel: assignment.ideaLevel ?? undefined,
									designLevel: assignment.designLevel ?? undefined,
									learningLevel: assignment.learningLevel ?? undefined,
									presentationLevel: assignment.presentationLevel ?? undefined,
								};
								return (
									<fieldset
										key={assignment.id}
										className="rounded-2xl border border-dark-primary-color/25 p-4"
									>
										<legend className="px-2 text-xl font-bold">
											{category?.[locale] ?? assignment.categoryCode}
										</legend>
										<p className="mb-4 text-sm">{category?.guidance[locale]}</p>
										{assignment.isMain ? (
											<div className="flex flex-col gap-5">
												{MAIN_RUBRIC.map(criterion => (
													<div key={criterion.key}>
														<p className="font-bold">
															{criterion.label[locale]} · {criterion.maximum}
														</p>
														<div className="mt-1 grid gap-1 text-xs text-dark-primary-color/80 sm:grid-cols-3">
															<span>
																<strong>{t("guidance-low")}:</strong>{" "}
																{criterion.guidance[locale].low}
															</span>
															<span>
																<strong>{t("guidance-competent")}:</strong>{" "}
																{criterion.guidance[locale].competent}
															</span>
															<span>
																<strong>{t("guidance-standout")}:</strong>{" "}
																{criterion.guidance[locale].standout}
															</span>
														</div>
														<div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
															{[0, 1, 2, 3, 4, 5].map(level => (
																<button
																	key={level}
																	type="button"
																	aria-pressed={assignment[criterion.key] === level}
																	className={`rounded-lg border p-2 ${assignment[criterion.key] === level ? "border-highlight-color bg-highlight-color text-white" : "bg-white"}`}
																	onClick={() =>
																		void queueChange(assignment.id, {
																			[criterion.key]: level,
																		})
																	}
																>
																	<strong>{level}</strong>
																	<span className="block text-xs">
																		{SCORE_LEVEL_LABELS[level]?.[locale] ?? level}
																	</span>
																	<span className="block text-xs">
																		{pointsForLevel(level, criterion.maximum)} /{" "}
																		{criterion.maximum}
																	</span>
																</button>
															))}
														</div>
													</div>
												))}
												<p className="text-lg font-bold">
													{t("main-total", { score: mainScoreTotal(levels) })}
												</p>
											</div>
										) : (
											<div className="flex flex-col gap-4">
												<div>
													<p className="font-bold">{t("mini-eligibility")}</p>
													<div className="mt-2 flex flex-wrap gap-2">
														{(["ELIGIBLE", "UNSURE", "INELIGIBLE"] as const).map(value => (
															<button
																key={value}
																type="button"
																aria-pressed={assignment.miniEligibility === value}
																className={`ui-button ${assignment.miniEligibility === value ? "ui-button-primary" : ""}`}
																onClick={() =>
																	void queueChange(assignment.id, {
																		miniEligibility: value,
																		...(value !== "ELIGIBLE"
																			? { miniScore: null }
																			: {}),
																	})
																}
															>
																{t(value.toLowerCase())}
															</button>
														))}
													</div>
												</div>
												{requiresResolvedEligibleScore && (
													<p className="rounded-lg bg-amber-50 p-3 text-sm font-bold">
														{t("eligibility-resolved-eligible")}
													</p>
												)}
												{(assignment.miniEligibility === "ELIGIBLE" ||
													requiresResolvedEligibleScore) && (
													<div>
														<p className="font-bold">{t("mini-score")}</p>
														<div className="mt-2 flex gap-2">
															{[1, 2, 3, 4, 5].map(score => (
																<button
																	key={score}
																	type="button"
																	aria-pressed={assignment.miniScore === score}
																	className={`h-12 w-12 rounded-lg border text-lg font-bold ${assignment.miniScore === score ? "border-highlight-color bg-highlight-color text-white" : "bg-white"}`}
																	onClick={() =>
																		void queueChange(assignment.id, {
																			miniScore: score,
																		})
																	}
																>
																	{score}
																</button>
															))}
														</div>
													</div>
												)}
											</div>
										)}
										<label className="mt-5 block font-bold">
											{t("note")}
											<textarea
												className="ui-field mt-2 min-h-24 w-full"
												value={assignment.note ?? ""}
												onChange={event =>
													void queueChange(assignment.id, { note: event.target.value })
												}
											/>
										</label>
										{!assignment.isMain &&
											(assignment.miniEligibility === "UNSURE" ||
												assignment.miniEligibility === "INELIGIBLE") &&
											!assignment.note?.trim() && (
												<p className="mt-2 text-sm font-bold text-red-700">
													{t("note-required")}
												</p>
											)}
										<label className="mt-3 flex items-center gap-2">
											<input
												type="checkbox"
												checked={assignment.rulesConcern}
												onChange={event =>
													void queueChange(assignment.id, {
														rulesConcern: event.target.checked,
													})
												}
											/>
											{t("rules-concern")}
										</label>
									</fieldset>
								);
							})}
					</section>
				)}
				{selectedProject && (
					<div className="flex justify-between gap-3">
						<button
							type="button"
							className="ui-button"
							disabled={projects.indexOf(selectedProject) <= 0}
							onClick={() =>
								setSelectedProjectId(
									projects[projects.indexOf(selectedProject) - 1]?.id ?? selectedProject.id,
								)
							}
						>
							{t("previous")}
						</button>
						<button
							type="button"
							className="ui-button"
							disabled={projects.indexOf(selectedProject) >= projects.length - 1}
							onClick={() =>
								setSelectedProjectId(
									projects[projects.indexOf(selectedProject) + 1]?.id ?? selectedProject.id,
								)
							}
						>
							{t("next")}
						</button>
					</div>
				)}

				{projects.length === 0 && (
					<section className="ui-panel p-5 text-center">
						<p className="text-lg font-bold text-green-800">{t("complete")}</p>
					</section>
				)}
			</div>
		</App>
	);
}
