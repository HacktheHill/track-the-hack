import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import {
	clearOfflineJudgingData,
	listJudgingOutbox,
	loadJudgingSnapshot,
	markRankingAccessVerified,
	queueAssignmentPatch,
	queueRankingPatch,
	removeJudgingOutboxEntries,
	saveJudgingSnapshot,
	type JudgingManifest,
	type OfflineJudgingPatch,
} from "@/client/judging-offline";
import { chunkJudgingOutbox as createSyncBatches, isRankingAccessCurrent } from "@/client/judging-offline-state";
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

const rankingsFromManifest = (manifest: JudgingManifest) =>
	Object.fromEntries(
		[...new Set(manifest.judge.assignments.map(assignment => assignment.categoryCode))].map(categoryCode => {
			const saved = manifest.judge.rankings
				.filter(ranking => ranking.categoryCode === categoryCode)
				.sort((a, b) => a.rank - b.rank)
				.map(ranking => ranking.projectId);
			const eligible = manifest.judge.assignments
				.filter(
					assignment =>
						assignment.categoryCode === categoryCode &&
						!assignment.recusedAt &&
						assignment.project.categories.find(category => category.code === categoryCode)
							?.eligibilityResolution !== "INELIGIBLE" &&
						(assignment.isMain ||
							assignment.miniEligibility === "ELIGIBLE" ||
							assignmentResolution(assignment) === "ELIGIBLE") &&
						assignmentComplete(assignment),
				)
				.map(assignment => assignment.project.id);
			const eligibleIds = [...new Set(eligible)];
			const eligibleSet = new Set(eligibleIds);
			return [
				categoryCode,
				[
					...saved.filter(projectId => eligibleSet.has(projectId)),
					...eligibleIds.filter(projectId => !saved.includes(projectId)),
				],
			];
		}),
	);

const hydrateManifestWithOutbox = (manifest: JudgingManifest, entries: OfflineJudgingPatch[]) => ({
	...manifest,
	judge: {
		...manifest.judge,
		assignments: manifest.judge.assignments.map(assignment => {
			const patch = entries.find(entry => entry.kind === "assignment" && entry.assignmentId === assignment.id);
			return patch?.kind === "assignment"
				? // IndexedDB values were produced only by the typed assignment controls.
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					({
						...assignment,
						...patch.values,
						recusedAt:
							"recusalReason" in patch.values
								? patch.values.recusalReason
									? new Date(patch.editedAt)
									: null
								: assignment.recusedAt,
					} as Assignment)
				: assignment;
		}),
	},
});

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
	const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
	const [rankingOrders, setRankingOrders] = useState<Record<string, string[]>>({});
	const [workspaceStep, setWorkspaceStep] = useState<"scoring" | "ranking">("scoring");
	const [rankingAccessVersion, setRankingAccessVersion] = useState<number | null>(null);
	const [rankingGateState, setRankingGateState] = useState<"idle" | "checking" | "offline" | "failed" | "incomplete">(
		"idle",
	);
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
			const verifiedVersion = snapshot.rankingVerifiedAssignmentVersion ?? null;
			setRankingAccessVersion(verifiedVersion);
			if (!isRankingAccessCurrent(verifiedVersion, next.judge.round.assignmentVersion))
				setWorkspaceStep("scoring");
			const entries = await refreshOutbox();
			const hydrated = hydrateManifestWithOutbox(next, entries);
			if (next.judge.round.state === "LOCKED" && entries.length === 0) await clearOfflineJudgingData();
			setManifest(hydrated);
			setRankingOrders({
				...rankingsFromManifest(hydrated),
				...Object.fromEntries(
					entries
						.filter(entry => entry.kind === "ranking")
						.map(entry => [entry.categoryCode, entry.projectIds]),
				),
			});
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
				const verifiedVersion = snapshot.rankingVerifiedAssignmentVersion ?? null;
				setRankingAccessVersion(verifiedVersion);
				if (
					isRankingAccessCurrent(verifiedVersion, hydrated.judge.round.assignmentVersion) &&
					hydrated.judge.assignments.every(assignmentComplete)
				)
					setWorkspaceStep("ranking");
				setRankingOrders({
					...rankingsFromManifest(hydrated),
					...Object.fromEntries(
						entries
							.filter(entry => entry.kind === "ranking")
							.map(entry => [entry.categoryCode, entry.projectIds]),
					),
				});
				setSelectedProjectId(hydrated.judge.assignments[0]?.project.id ?? null);
				setSyncState(typeof navigator !== "undefined" && navigator.onLine ? "failed" : "offline");
			});
		});
		void refreshOutbox();
	}, [isOnline, manifest, refreshOutbox]);

	useEffect(() => {
		if (
			manifest &&
			rankingAccessVersion !== null &&
			!isRankingAccessCurrent(rankingAccessVersion, manifest.judge.round.assignmentVersion)
		) {
			setRankingAccessVersion(null);
			setWorkspaceStep("scoring");
			setRankingGateState("incomplete");
		}
	}, [manifest, rankingAccessVersion]);

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

	useEffect(() => {
		if (!manifest) return;
		const eligibleOrders = rankingsFromManifest(manifest);
		setRankingOrders(current =>
			Object.fromEntries(
				Object.entries(eligibleOrders).map(([categoryCode, eligibleOrder]) => {
					const currentOrder = current[categoryCode] ?? [];
					return [
						categoryCode,
						[
							...currentOrder.filter(projectId => eligibleOrder.includes(projectId)),
							...eligibleOrder.filter(projectId => !currentOrder.includes(projectId)),
						],
					];
				}),
			),
		);
	}, [manifest]);

	const assignments = useMemo(() => manifest?.judge.assignments ?? [], [manifest]);
	const projects = useMemo(() => {
		const unique = new Map<string, Assignment["project"]>();
		for (const assignment of assignments) unique.set(assignment.project.id, assignment.project);
		return [...unique.values()].sort((a, b) => a.room.localeCompare(b.room) || a.tableNumber - b.tableNumber);
	}, [assignments]);
	const selectedProject = projects.find(project => project.id === selectedProjectId) ?? projects[0];
	const selectedAssignments = assignments.filter(assignment => assignment.project.id === selectedProject?.id);

	const queueChange = useCallback(
		async (assignmentId: string, values: AssignmentPatch) => {
			await queueAssignmentPatch(assignmentId, values);
			setManifest(current =>
				current
					? {
							...current,
							judge: {
								...current.judge,
								assignments: current.judge.assignments.map(assignment =>
									assignment.id === assignmentId
										? {
												...assignment,
												...values,
												recusedAt:
													"recusalReason" in values
														? values.recusalReason
															? new Date()
															: null
														: assignment.recusedAt,
											}
										: assignment,
								),
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

	const saveRanking = useCallback(
		async (categoryCode: string, order: string[]) => {
			if (!manifest || !isRankingAccessCurrent(rankingAccessVersion, manifest.judge.round.assignmentVersion))
				return;
			setRankingOrders(current => ({ ...current, [categoryCode]: order }));
			await queueRankingPatch(categoryCode, order);
			await refreshOutbox();
			setSyncState(navigator.onLine ? "syncing" : "offline");
			if (navigator.onLine) window.setTimeout(() => void sync(), 0);
		},
		[manifest, rankingAccessVersion, refreshOutbox, sync],
	);

	const checkAssignmentsAndContinue = useCallback(async () => {
		if (!navigator.onLine) {
			setRankingGateState("offline");
			return;
		}
		setRankingGateState("checking");
		try {
			await sync();
			if ((await listJudgingOutbox()).length > 0) {
				setRankingGateState("failed");
				return;
			}
			const refreshed = await manifestQuery.refetch();
			if (!refreshed.data) {
				setRankingGateState("failed");
				return;
			}
			await applyManifest(refreshed.data);
			if (!refreshed.data.judge.assignments.every(assignmentComplete)) {
				setRankingAccessVersion(null);
				setRankingGateState("incomplete");
				return;
			}
			await markRankingAccessVerified(refreshed.data);
			setRankingAccessVersion(refreshed.data.judge.round.assignmentVersion);
			setRankingGateState("idle");
			setWorkspaceStep("ranking");
		} catch {
			setRankingGateState("failed");
		}
	}, [applyManifest, manifestQuery, sync]);

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

	const allComplete = assignments.every(assignmentComplete);
	const rankingsComplete = Object.entries(rankingOrders).every(([categoryCode, order]) => {
		if (order.length <= 1) return true;
		const saved = manifest.judge.rankings.filter(
			ranking => ranking.categoryCode === categoryCode && ranking.confirmedAt,
		);
		return saved.length === order.length && saved.every(ranking => order.includes(ranking.projectId));
	});
	const bannerKey = syncState === "synced" && outboxCount ? "failed" : syncState;
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
					<button
						type="button"
						className="ui-button"
						disabled={syncState === "syncing"}
						onClick={() => void sync()}
					>
						{t("sync.now")}
					</button>
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

				<div
					className={`${workspaceStep === "scoring" ? "flex" : "hidden"} gap-2 overflow-x-auto pb-2`}
					aria-label={t("title")}
				>
					{projects.map(project => {
						const projectAssignments = assignments.filter(
							assignment => assignment.project.id === project.id,
						);
						const complete = projectAssignments.every(assignmentComplete);
						const recused = projectAssignments.every(assignment => assignment.recusedAt);
						const localOnly = projectAssignments.some(assignment => localAssignmentIds.has(assignment.id));
						const needsReview = projectAssignments.some(
							assignment =>
								(assignment.miniEligibility === "UNSURE" && !assignmentResolution(assignment)) ||
								(assignment.recusedAt && !assignment.recusalAcceptedAt),
						);
						const started = projectAssignments.some(
							assignment =>
								assignment.completedAt ||
								assignment.note ||
								assignment.miniEligibility ||
								assignment.technicalLevel !== null ||
								assignment.recusedAt,
						);
						const status = localOnly
							? "stored-locally"
							: recused
								? "recused"
								: needsReview
									? "needs-review"
									: complete
										? "synced"
										: started
											? "in-progress"
											: "not-started";
						return (
							<button
								key={project.id}
								type="button"
								onClick={() => setSelectedProjectId(project.id)}
								className={`min-w-36 rounded-xl border-2 p-3 text-left ${project.id === selectedProject?.id ? "border-highlight-color bg-white" : "border-dark-primary-color/20 bg-white/60"}`}
							>
								<strong>{t("table", { number: project.tableNumber })}</strong>
								<span className="block truncate text-sm">{project.name}</span>
								<span className="block text-xs">{t(`status.${status}`)}</span>
							</button>
						);
					})}
				</div>

				{workspaceStep === "scoring" && selectedProject && (
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
						{selectedAssignments.map(assignment => {
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
									{assignment.recusedAt && (
										<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3">
											<strong>{t("status.recused")}</strong>
											<button
												type="button"
												className="ui-button"
												onClick={() => void queueChange(assignment.id, { recusalReason: null })}
											>
												{t("undo-recusal")}
											</button>
										</div>
									)}
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
											<p className="mt-2 text-sm font-bold text-red-700">{t("note-required")}</p>
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
									<label className="mt-3 block font-bold">
										{t("recusal-reason")}
										<input
											className="ui-field mt-2 w-full"
											value={assignment.recusalReason ?? ""}
											onChange={event =>
												void queueChange(assignment.id, {
													recusalReason: event.target.value || null,
												})
											}
											placeholder={t("recusal")}
										/>
									</label>
								</fieldset>
							);
						})}
					</section>
				)}
				{workspaceStep === "scoring" && selectedProject && (
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

				{workspaceStep === "scoring" && allComplete && (
					<section className="ui-panel flex flex-col gap-3 p-5">
						<h2 className="text-2xl font-bold">{t("ranking-gate-title")}</h2>
						<p>{t("ranking-gate-help")}</p>
						{rankingGateState !== "idle" && rankingGateState !== "checking" && (
							<p className="font-bold text-amber-800">{t(`ranking-gate-${rankingGateState}`)}</p>
						)}
						{rankingGateState === "checking" && <p role="status">{t("ranking-gate-checking")}</p>}
						<button
							type="button"
							className="ui-button ui-button-primary self-start"
							disabled={rankingGateState === "checking"}
							onClick={() => void checkAssignmentsAndContinue()}
						>
							{t("ranking-gate-action")}
						</button>
					</section>
				)}

				{workspaceStep === "ranking" &&
					isRankingAccessCurrent(rankingAccessVersion, manifest.judge.round.assignmentVersion) && (
						<section className="ui-panel flex flex-col gap-5 p-5">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<button type="button" className="ui-button" onClick={() => setWorkspaceStep("scoring")}>
									{t("back-to-scoring")}
								</button>
								<p className="text-sm font-bold text-green-800">
									{t("ranking-version", { version: rankingAccessVersion })}
								</p>
							</div>
							<h2 className="text-2xl font-bold">{t("rankings")}</h2>
							<p>{t("rank-help")}</p>
							{Object.entries(rankingOrders).map(
								([categoryCode, order]) =>
									order.length > 1 && (
										<div key={categoryCode}>
											<h3 className="text-lg font-bold">
												{categoryDefinition(categoryCode)?.[locale] ?? categoryCode}
											</h3>
											<ol className="mt-2 flex flex-col gap-2">
												{order.map((projectId, index) => {
													const project = projects.find(item => item.id === projectId);
													if (!project) return null;
													const move = (offset: number) => {
														const next = [...order];
														const target = index + offset;
														if (target < 0 || target >= next.length) return;
														const current = next[index];
														const replacement = next[target];
														if (current === undefined || replacement === undefined) return;
														next[index] = replacement;
														next[target] = current;
														void saveRanking(categoryCode, next);
													};
													return (
														<li
															key={projectId}
															draggable
															onDragStart={() => setDraggedProjectId(projectId)}
															onDragOver={event => event.preventDefault()}
															onDrop={() => {
																if (!draggedProjectId || draggedProjectId === projectId)
																	return;
																const next = order.filter(
																	id => id !== draggedProjectId,
																);
																next.splice(index, 0, draggedProjectId);
																setDraggedProjectId(null);
																void saveRanking(categoryCode, next);
															}}
															className="flex items-center gap-2 rounded-xl border bg-white p-3"
														>
															<span className="w-7 font-bold">{index + 1}</span>
															<span className="flex-1">
																{t("table", { number: project.tableNumber })} ·{" "}
																{project.name}
															</span>
															<button
																type="button"
																className="ui-button"
																disabled={index === 0}
																onClick={() => move(-1)}
															>
																{t("move-up")}
															</button>
															<button
																type="button"
																className="ui-button"
																disabled={index === order.length - 1}
																onClick={() => move(1)}
															>
																{t("move-down")}
															</button>
														</li>
													);
												})}
											</ol>
											<button
												type="button"
												className="ui-button mt-3"
												onClick={() => void saveRanking(categoryCode, order)}
											>
												{t("confirm-ranking")}
											</button>
										</div>
									),
							)}
							{outboxCount > 0 ? (
								<p className="font-bold text-amber-800">{t("ready-local")}</p>
							) : !rankingsComplete ? (
								<p className="font-bold text-amber-800">{t("ranking-stale")}</p>
							) : (
								<p className="font-bold text-green-800">{t("complete")}</p>
							)}
						</section>
					)}
			</div>
		</App>
	);
}
