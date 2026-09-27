import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useState } from "react";
import App from "@/components/App";
import Error from "@/components/Error";
import Loading from "@/components/Loading";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";
import { trpc, type RouterOutputs } from "@/server/api/api";
import { organizerRedirect } from "@/server/lib/redirects";

const readFile = (file: File | undefined, setter: (value: string) => void) => {
	if (!file) return;
	void file.text().then(setter);
};

const downloadCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
	const headers = Object.keys(rows[0] ?? {});
	const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
	const source = [
		headers.map(escape).join(","),
		...rows.map(row => headers.map(header => escape(row[header])).join(",")),
	].join("\n");
	const url = URL.createObjectURL(new Blob([source], { type: "text/csv;charset=utf-8" }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
};

export default function JudgingAdminPage() {
	const { t } = useTranslation("internal");
	const [name, setName] = useState("Hack the Hill III");
	const [projectCsv, setProjectCsv] = useState("");
	const [judgeCsv, setJudgeCsv] = useState("");
	const [optionalProjectId, setOptionalProjectId] = useState("");
	const [optionalCategoryCode, setOptionalCategoryCode] = useState("");
	const [optionalJudgeId, setOptionalJudgeId] = useState("");
	const [visitProjectId, setVisitProjectId] = useState("");
	const [visitSourceJudgeId, setVisitSourceJudgeId] = useState("");
	const [visitTargetJudgeId, setVisitTargetJudgeId] = useState("");
	const [firstSwapAssignmentId, setFirstSwapAssignmentId] = useState("");
	const [secondSwapAssignmentId, setSecondSwapAssignmentId] = useState("");
	const [preview, setPreview] = useState<RouterOutputs["judging"]["previewImport"] | null>(null);
	const utils = trpc.useContext();
	const overview = trpc.judging.adminOverview.useQuery();
	const previewMutation = trpc.judging.previewImport.useMutation({ onSuccess: setPreview });
	const applyMutation = trpc.judging.applyImport.useMutation({
		onSuccess: async () => {
			setPreview(null);
			await utils.judging.adminOverview.invalidate();
		},
	});
	const approve = trpc.judging.approveOverload.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const publish = trpc.judging.publish.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const regenerate = trpc.judging.regenerateDraft.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const lock = trpc.judging.lock.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const reopen = trpc.judging.reopen.useMutation({ onSuccess: async () => utils.judging.adminOverview.invalidate() });
	const move = trpc.judging.moveAssignment.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const moveVisit = trpc.judging.moveProjectVisit.useMutation({
		onSuccess: async () => {
			setVisitProjectId("");
			setVisitSourceJudgeId("");
			setVisitTargetJudgeId("");
			await utils.judging.adminOverview.invalidate();
		},
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const swapAssignments = trpc.judging.swapAssignments.useMutation({
		onSuccess: async () => {
			setFirstSwapAssignmentId("");
			setSecondSwapAssignmentId("");
			await utils.judging.adminOverview.invalidate();
		},
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const addOptional = trpc.judging.addOptionalAssignment.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const removeOptional = trpc.judging.removeOptionalAssignment.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
		onError: async () => utils.judging.adminOverview.invalidate(),
	});
	const acceptRecusal = trpc.judging.acceptRecusal.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
	});
	const resolveEligibility = trpc.judging.resolveEligibility.useMutation({
		onSuccess: async () => utils.judging.adminOverview.invalidate(),
	});
	const results = trpc.judging.results.useQuery(
		{ roundId: overview.data?.id ?? "" },
		{ enabled: Boolean(overview.data?.id) },
	);
	const mutationError =
		previewMutation.error ??
		applyMutation.error ??
		approve.error ??
		publish.error ??
		regenerate.error ??
		lock.error ??
		reopen.error ??
		move.error ??
		moveVisit.error ??
		swapAssignments.error ??
		addOptional.error ??
		removeOptional.error ??
		acceptRecusal.error ??
		resolveEligibility.error;
	const round = overview.data;
	const synchronizedProgress = round
		? round.judgeLoads.reduce(
				(progress, judge) => ({
					complete: progress.complete + judge.complete,
					total: progress.total + judge.scopes,
				}),
				{ complete: 0, total: 0 },
			)
		: { complete: 0, total: 0 };
	const synchronizedProgressPercent = synchronizedProgress.total
		? Math.round((synchronizedProgress.complete / synchronizedProgress.total) * 100)
		: 0;
	const previewCohorts = preview?.generation
		? [...new Set(preview.generation.assignments.map(assignment => assignment.categoryCode))]
				.sort()
				.map(categoryCode => {
					const assignments = preview.generation?.assignments.filter(
						assignment => assignment.categoryCode === categoryCode,
					);
					return {
						categoryCode,
						judges: [...new Set(assignments?.map(assignment => assignment.judgeEmail))],
						projects: new Set(assignments?.map(assignment => assignment.projectExternalId)).size,
						assignments: assignments?.length ?? 0,
						anchors: assignments?.filter(assignment => assignment.calibrationAnchor).length ?? 0,
					};
				})
		: [];

	return (
		<App className="overflow-y-auto bg-default-gradient" integrated title={t("judging.title")}>
			<div className="ui-form-layout mx-auto flex max-w-6xl flex-col gap-6 p-6">
				<h1 className="ui-page-title text-center">{t("judging.title")}</h1>
				<section className="ui-panel flex flex-col gap-4 p-5">
					<label className="font-bold">
						{t("judging.round-name")}
						<input
							className="ui-field mt-2 w-full"
							value={name}
							onChange={event => setName(event.target.value)}
						/>
					</label>
					<label className="font-bold">
						{t("judging.projects-csv")}
						<input
							className="mt-2 block"
							type="file"
							accept=".csv,text/csv"
							onChange={event => readFile(event.target.files?.[0], setProjectCsv)}
						/>
					</label>
					<label className="font-bold">
						{t("judging.judges-csv")}
						<input
							className="mt-2 block"
							type="file"
							accept=".csv,text/csv"
							onChange={event => readFile(event.target.files?.[0], setJudgeCsv)}
						/>
					</label>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className="ui-button"
							disabled={!projectCsv || !judgeCsv || previewMutation.isLoading}
							onClick={() => previewMutation.mutate({ projectCsv, judgeCsv })}
						>
							{t("judging.preview")}
						</button>
						<button
							type="button"
							className="ui-button ui-button-primary"
							disabled={
								!preview ||
								Boolean(
									preview.projects.errors.length ||
									preview.judges.errors.length ||
									preview.generation?.errors.length,
								) ||
								applyMutation.isLoading
							}
							onClick={() => {
								const replaceExistingDraft = round?.state === "DRAFT";
								if (replaceExistingDraft && !confirm(t("judging.replace-draft-confirm"))) return;
								applyMutation.mutate({ name, projectCsv, judgeCsv, replaceExistingDraft });
							}}
						>
							{t("judging.apply")}
						</button>
					</div>
					{preview && (
						<div className="grid gap-3 sm:grid-cols-3">
							<p>{t("judging.projects", { count: preview.projects.rows.length })}</p>
							<p>{t("judging.judges", { count: preview.judges.rows.length })}</p>
							<p>{t("judging.assignments", { count: preview.generation?.assignments.length ?? 0 })}</p>
							{preview.generation && (
								<>
									<p className="font-bold sm:col-span-3">
										{t("judging.proposed-limit", {
											count: preview.generation.effectiveProjectLimit,
										})}
									</p>
									<div className="overflow-x-auto sm:col-span-3">
										<table className="w-full text-left">
											<thead>
												<tr>
													<th>{t("judging.judge")}</th>
													<th>{t("judging.projects-heading")}</th>
													<th>{t("judging.scopes")}</th>
													<th>{t("judging.rooms")}</th>
													<th>{t("judging.expert")}</th>
													<th>{t("judging.fallback")}</th>
												</tr>
											</thead>
											<tbody>
												{preview.generation.judgeLoads.map(load => (
													<tr
														key={load.email}
														className={
															load.projects > 15 ? "border-t bg-amber-50" : "border-t"
														}
													>
														<td>{load.email}</td>
														<td>{load.projects}</td>
														<td>{load.scopes}</td>
														<td>{load.rooms.join(", ")}</td>
														<td>
															{
																preview.generation?.assignments.filter(
																	assignment =>
																		assignment.judgeEmail === load.email &&
																		assignment.expertiseMatch,
																).length
															}
														</td>
														<td>
															{
																preview.generation?.assignments.filter(
																	assignment =>
																		assignment.judgeEmail === load.email &&
																		!assignment.isMain &&
																		!assignment.expertiseMatch,
																).length
															}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</>
							)}
							<ul className="list-disc pl-5 sm:col-span-3">
								{[
									...preview.projects.errors,
									...preview.judges.errors,
									...(preview.generation?.errors ?? []),
									...preview.projects.warnings,
									...(preview.generation?.warnings ?? []),
								].map((message, index) => (
									<li key={index}>{message}</li>
								))}
							</ul>
						</div>
					)}
				</section>

				{overview.isLoading && <Loading />}
				{round ? (
					<section className="ui-panel flex flex-col gap-4 p-5">
						<h2 className="text-2xl font-bold">{round.name}</h2>
						<div className="grid gap-2 sm:grid-cols-4">
							<p>{t("judging.state", { state: round.state })}</p>
							<p>{t("judging.projects", { count: round.projects.length })}</p>
							<p>{t("judging.judges", { count: round.judges.length })}</p>
							<p>{t("judging.assignments", { count: round.assignments.length })}</p>
						</div>
						<p>{t("judging.limit", { count: round.effectiveProjectLimit })}</p>
						<div className="rounded-xl border-2 border-dark-primary-color/20 bg-white p-4">
							<h3 className="font-bold">{t("judging.progress-heading")}</h3>
							<p className="mt-1">
								{t("judging.progress-summary", {
									complete: synchronizedProgress.complete,
									total: synchronizedProgress.total,
									remaining: synchronizedProgress.total - synchronizedProgress.complete,
									percent: synchronizedProgressPercent,
								})}
							</p>
							<p className="mt-1 text-sm">{t("judging.progress-sync-note")}</p>
						</div>
						<div className="flex flex-wrap gap-3">
							{round.effectiveProjectLimit > 15 && !round.overloadApprovedAt && (
								<button
									type="button"
									className="ui-button"
									onClick={() =>
										approve.mutate({
											roundId: round.id,
											expectedAssignmentVersion: round.assignmentVersion,
										})
									}
								>
									{t("judging.approve-overload")}
								</button>
							)}
							{round.state === "DRAFT" && (
								<>
									<button
										type="button"
										className="ui-button"
										disabled={regenerate.isLoading}
										onClick={() =>
											confirm(t("judging.regenerate-confirm")) &&
											regenerate.mutate({
												roundId: round.id,
												expectedAssignmentVersion: round.assignmentVersion,
											})
										}
									>
										{t("judging.regenerate")}
									</button>
									<button
										type="button"
										className="ui-button ui-button-primary"
										onClick={() =>
											publish.mutate({
												roundId: round.id,
												expectedAssignmentVersion: round.assignmentVersion,
											})
										}
									>
										{t("judging.publish")}
									</button>
								</>
							)}
							{round.state === "OPEN" && (
								<>
									<button
										type="button"
										className="ui-button"
										onClick={() =>
											lock.mutate({
												roundId: round.id,
												expectedAssignmentVersion: round.assignmentVersion,
												force: false,
											})
										}
									>
										{t("judging.lock")}
									</button>
									<button
										type="button"
										className="ui-button"
										onClick={() =>
											confirm(t("judging.force-lock")) &&
											lock.mutate({
												roundId: round.id,
												expectedAssignmentVersion: round.assignmentVersion,
												force: true,
											})
										}
									>
										{t("judging.force-lock")}
									</button>
								</>
							)}
							{round.state === "LOCKED" && (
								<button
									type="button"
									className="ui-button"
									onClick={() => reopen.mutate({ roundId: round.id })}
								>
									{t("judging.reopen")}
								</button>
							)}
							<button
								type="button"
								className="ui-button"
								onClick={() =>
									downloadCsv(
										"judging-schedule.csv",
										round.assignments.map(assignment => ({
											judge_name: assignment.judge.name,
											judge_email: assignment.judge.email,
											table_number: assignment.project.tableNumber,
											room: assignment.project.room,
											project_name: assignment.project.name,
											category: assignment.categoryCode,
											expertise_match: assignment.expertiseMatch,
											calibration_anchor: assignment.calibrationAnchor,
										})),
									)
								}
							>
								{t("judging.export-schedule")}
							</button>
						</div>
						{round.generationWarningList.length > 0 && (
							<div className="rounded border border-amber-400 bg-amber-50 p-3 text-amber-950">
								<h3 className="font-bold">{t("judging.generation-warnings")}</h3>
								<ul className="list-disc pl-5">
									{round.generationWarningList.map((warning, index) => (
										<li key={index}>{warning}</li>
									))}
								</ul>
							</div>
						)}
						<div className="overflow-x-auto">
							<table className="w-full text-left">
								<thead>
									<tr>
										<th>{t("judging.judge")}</th>
										<th>{t("judging.email")}</th>
										<th>{t("judging.projects-heading")}</th>
										<th>{t("judging.scopes")}</th>
										<th>{t("judging.expert")}</th>
										<th>{t("judging.fallback")}</th>
										<th>{t("judging.route")}</th>
										<th>{t("judging.complete-heading")}</th>
										<th>{t("judging.last-sync")}</th>
									</tr>
								</thead>
								<tbody>
									{round.judgeLoads.map(judge => (
										<tr key={judge.id} className="border-t">
											<td>{judge.name}</td>
											<td>{judge.email}</td>
											<td>{judge.projects}</td>
											<td>{judge.scopes}</td>
											<td>{judge.expertScopes}</td>
											<td>{judge.fallbackScopes}</td>
											<td>
												{judge.route
													.map(visit => `${visit.room} #${visit.tableNumber}`)
													.join(" → ") || "—"}
											</td>
										<td>
											{t("judging.judge-progress", {
												complete: judge.complete,
												total: judge.scopes,
												remaining: judge.scopes - judge.complete,
												percent: judge.scopes ? Math.round((judge.complete / judge.scopes) * 100) : 0,
											})}
										</td>
											<td>
												{judge.lastSyncAt ? new Date(judge.lastSyncAt).toLocaleString() : "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<h3 className="text-xl font-bold">{t("judging.category-cohorts")}</h3>
						<div className="overflow-x-auto">
							<table className="w-full text-left">
								<thead>
									<tr>
										<th>{t("judging.category")}</th>
										<th>{t("judging.judges-heading")}</th>
										<th>{t("judging.projects-heading")}</th>
										<th>{t("judging.assignments-heading")}</th>
										<th>{t("judging.anchors")}</th>
									</tr>
								</thead>
								<tbody>
									{round.categoryCohorts.map(cohort => (
										<tr key={cohort.categoryCode} className="border-t">
											<td>{cohort.categoryCode}</td>
											<td>
												{cohort.judgeIds
													.map(id => round.judges.find(judge => judge.id === id)?.name ?? id)
													.join(", ")}
											</td>
											<td>{cohort.projectCount}</td>
											<td>{cohort.assignmentCount}</td>
											<td>
												{cohort.sharedProjectCount}
												{cohort.insufficientOverlap
													? ` · ${t("judging.insufficient-overlap")}`
													: ""}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<h3 className="text-xl font-bold">{t("judging.coverage")}</h3>
						<div className="max-h-72 overflow-auto">
							<table className="w-full text-left">
								<thead>
									<tr>
										<th>{t("judging.table")}</th>
										<th>{t("judging.project")}</th>
										<th>{t("judging.category")}</th>
										<th>{t("judging.active-assessment-count")}</th>
										<th>{t("judging.recused-assessment-count")}</th>
										<th>{t("judging.judges-heading")}</th>
									</tr>
								</thead>
								<tbody>
									{round.coverage.map(item => (
										<tr
											key={`${item.projectId}:${item.categoryCode}`}
											className={item.count === 0 ? "border-t bg-red-50" : "border-t"}
										>
											<td>
												{item.room} #{item.tableNumber}
											</td>
											<td>{item.projectName}</td>
											<td>{item.categoryCode}</td>
											<td>{item.count}</td>
											<td>{item.recusedCount}</td>
											<td>
												{item.judgeIds
													.map(id => round.judges.find(judge => judge.id === id)?.name ?? id)
													.join(", ") || "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<h3 className="text-xl font-bold">{t("judging.ranking-readiness")}</h3>
						<p>{t("judging.ranking-readiness-note")}</p>
						<div className="max-h-72 overflow-auto">
							<table className="w-full text-left">
								<thead>
									<tr>
										<th>{t("judging.judge")}</th>
										<th>{t("judging.category")}</th>
										<th>{t("judging.eligible-ranked-projects")}</th>
										<th>{t("judging.ranking-status")}</th>
									</tr>
								</thead>
								<tbody>
									{round.rankingStatuses.map(status => (
										<tr
											key={`${status.judgeId}:${status.categoryCode}`}
											className={
												status.status === "COMPLETE" || status.status === "AUTOMATIC"
													? "border-t"
													: "border-t bg-amber-50"
											}
										>
											<td>
												{round.judges.find(judge => judge.id === status.judgeId)?.name ??
													status.judgeId}
											</td>
											<td>{status.categoryCode}</td>
											<td>{status.eligibleProjectCount}</td>
											<td>
												{t(
													`judging.ranking-status-${status.status.toLowerCase().replace("_", "-")}`,
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<h3 className="text-xl font-bold">{t("judging.move-visit")}</h3>
						<div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
							<select
								className="ui-field"
								value={visitProjectId}
								onChange={event => {
									setVisitProjectId(event.target.value);
									setVisitSourceJudgeId("");
								}}
							>
								<option value="">{t("judging.select-project")}</option>
								{round.projects.map(project => (
									<option key={project.id} value={project.id}>
										Table {project.tableNumber} · {project.name}
									</option>
								))}
							</select>
							<select
								className="ui-field"
								value={visitSourceJudgeId}
								onChange={event => setVisitSourceJudgeId(event.target.value)}
							>
								<option value="">{t("judging.source-judge")}</option>
								{[
									...new Set(
										round.assignments
											.filter(assignment => assignment.projectId === visitProjectId)
											.map(assignment => assignment.judgeId),
									),
								].map(judgeId => (
									<option key={judgeId} value={judgeId}>
										{round.judges.find(judge => judge.id === judgeId)?.name ?? judgeId}
									</option>
								))}
							</select>
							<select
								className="ui-field"
								value={visitTargetJudgeId}
								onChange={event => setVisitTargetJudgeId(event.target.value)}
							>
								<option value="">{t("judging.target-judge")}</option>
								{round.judges
									.filter(judge => judge.id !== visitSourceJudgeId)
									.map(judge => (
										<option key={judge.id} value={judge.id}>
											{judge.name}
										</option>
									))}
							</select>
							<button
								type="button"
								className="ui-button"
								disabled={!visitProjectId || !visitSourceJudgeId || !visitTargetJudgeId}
								onClick={() =>
									moveVisit.mutate({
										roundId: round.id,
										expectedAssignmentVersion: round.assignmentVersion,
										projectId: visitProjectId,
										sourceJudgeId: visitSourceJudgeId,
										targetJudgeId: visitTargetJudgeId,
									})
								}
							>
								{t("judging.move-visit")}
							</button>
						</div>
						<h3 className="text-xl font-bold">{t("judging.swap-assignments")}</h3>
						<div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
							{[
								{
									value: firstSwapAssignmentId,
									setter: setFirstSwapAssignmentId,
									exclude: secondSwapAssignmentId,
								},
								{
									value: secondSwapAssignmentId,
									setter: setSecondSwapAssignmentId,
									exclude: firstSwapAssignmentId,
								},
							].map((control, index) => (
								<select
									key={index}
									className="ui-field"
									value={control.value}
									onChange={event => control.setter(event.target.value)}
								>
									<option value="">{t("judging.select-assignment")}</option>
									{round.assignments
										.filter(assignment => assignment.id !== control.exclude)
										.map(assignment => (
											<option key={assignment.id} value={assignment.id}>
												Table {assignment.project.tableNumber} · {assignment.categoryCode} ·{" "}
												{assignment.judge.name}
											</option>
										))}
								</select>
							))}
							<button
								type="button"
								className="ui-button"
								disabled={!firstSwapAssignmentId || !secondSwapAssignmentId}
								onClick={() =>
									swapAssignments.mutate({
										firstAssignmentId: firstSwapAssignmentId,
										secondAssignmentId: secondSwapAssignmentId,
										expectedAssignmentVersion: round.assignmentVersion,
									})
								}
							>
								{t("judging.swap")}
							</button>
						</div>
						<h3 className="text-xl font-bold">{t("judging.move")}</h3>
						<div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
							<select
								className="ui-field"
								value={optionalProjectId}
								onChange={event => {
									setOptionalProjectId(event.target.value);
									setOptionalCategoryCode("");
								}}
							>
								<option value="">{t("judging.select-project")}</option>
								{round.projects.map(project => (
									<option key={project.id} value={project.id}>
										Table {project.tableNumber} · {project.name}
									</option>
								))}
							</select>
							<select
								className="ui-field"
								value={optionalCategoryCode}
								onChange={event => setOptionalCategoryCode(event.target.value)}
							>
								<option value="">{t("judging.select-category")}</option>
								{round.projects
									.filter(project => project.id === optionalProjectId)
									.flatMap(project => [
										...(project.mainTrack === "CGI" ? [] : [project.mainTrack]),
										...project.categories.map(category => category.code),
									])
									.map(code => (
										<option key={code} value={code}>
											{code}
										</option>
									))}
							</select>
							<select
								className="ui-field"
								value={optionalJudgeId}
								onChange={event => setOptionalJudgeId(event.target.value)}
							>
								<option value="">{t("judging.select-judge")}</option>
								{round.judges.map(judge => (
									<option key={judge.id} value={judge.id}>
										{judge.name}
									</option>
								))}
							</select>
							<button
								type="button"
								className="ui-button"
								disabled={!optionalProjectId || !optionalCategoryCode || !optionalJudgeId}
								onClick={() =>
									addOptional.mutate({
										roundId: round.id,
										projectId: optionalProjectId,
										categoryCode: optionalCategoryCode,
										judgeId: optionalJudgeId,
										calibrationAnchor: false,
										expectedAssignmentVersion: round.assignmentVersion,
									})
								}
							>
								{t("judging.add-optional")}
							</button>
						</div>
						<div className="max-h-96 overflow-auto">
							{round.assignments.map(assignment => {
								const coverage = round.assignments.filter(
									item =>
										item.projectId === assignment.projectId &&
										item.categoryCode === assignment.categoryCode,
								).length;
								return (
									<div
										key={assignment.id}
										className="grid gap-2 border-t py-2 sm:grid-cols-[1fr_1fr_auto]"
									>
										<span>
											Table {assignment.project.tableNumber} · {assignment.categoryCode}
											<small className="block">
												{assignment.assignmentReason}
												{assignment.recusedAt
													? ` · ${assignment.recusalReason ?? "Recused"}`
													: ""}
											</small>
										</span>
										<select
											className="ui-field"
											value={assignment.judgeId}
											onChange={event =>
												move.mutate({
													assignmentId: assignment.id,
													targetJudgeId: event.target.value,
													expectedAssignmentVersion: round.assignmentVersion,
												})
											}
										>
											{round.judges.map(judge => (
												<option key={judge.id} value={judge.id}>
													{judge.name}
												</option>
											))}
										</select>
										<span className="flex flex-wrap items-center gap-2">
											{assignment.expertiseMatch
												? t("judging.expert")
												: assignment.isMain
													? t("judging.main")
													: t("judging.fallback")}
											{coverage > 1 && (
												<button
													type="button"
													className="ui-button"
													onClick={() =>
														removeOptional.mutate({
															assignmentId: assignment.id,
															expectedAssignmentVersion: round.assignmentVersion,
														})
													}
												>
													{t("judging.remove-optional")}
												</button>
											)}
											{assignment.recusedAt && !assignment.recusalAcceptedAt && (
												<button
													type="button"
													className="ui-button"
													onClick={() =>
														acceptRecusal.mutate({ assignmentId: assignment.id })
													}
												>
													{t("judging.accept-recusal")}
												</button>
											)}
										</span>
									</div>
								);
							})}
						</div>
						<h3 className="text-xl font-bold">{t("judging.eligibility-review")}</h3>
						<div className="flex flex-col gap-2">
							{round.projects.flatMap(project =>
								project.categories
									.filter(category =>
										round.assignments.some(
											assignment =>
												assignment.projectId === project.id &&
												assignment.categoryCode === category.code &&
												(assignment.miniEligibility === "UNSURE" ||
													assignment.miniEligibility === "INELIGIBLE"),
										),
									)
									.map(category => (
										<div
											key={category.id}
											className="flex flex-wrap items-center gap-2 border-t py-2"
										>
											<span className="flex-1">
												Table {project.tableNumber} · {category.code} ·{" "}
												{category.eligibilityResolution ?? t("judging.unresolved")}
											</span>
											<button
												type="button"
												className="ui-button"
												onClick={() =>
													resolveEligibility.mutate({
														projectId: project.id,
														categoryCode: category.code,
														resolution: "ELIGIBLE",
													})
												}
											>
												{t("judging.eligible")}
											</button>
											<button
												type="button"
												className="ui-button"
												onClick={() =>
													resolveEligibility.mutate({
														projectId: project.id,
														categoryCode: category.code,
														resolution: "INELIGIBLE",
													})
												}
											>
												{t("judging.ineligible")}
											</button>
										</div>
									)),
							)}
						</div>
						<h3 className="text-xl font-bold">{t("judging.results")}</h3>
						<p>
							{results.data?.assessments.filter(item => item.complete).length ?? 0}{" "}
							{t("judging.synchronized-assessments")}
						</p>
						{results.data && (
							<button
								type="button"
								className="ui-button"
								onClick={() =>
									downloadCsv(
										"judging-results.csv",
										results.data.aggregates.map(item => ({
											project_name: item.projectName,
											table_number: item.tableNumber,
											main_track: item.mainTrack,
											category: item.categoryCode,
											numeric_aggregate: item.numericAggregate,
											included_assessments: item.includedAssessments,
											ordinal_percentile: item.ordinalPercentile,
											needs_review: item.needsReview,
											official_position: item.officialPosition,
											unresolved_tie: item.unresolvedTie,
											unequal_assessment_count: item.unequalAssessmentCount,
										})),
									)
								}
							>
								{t("judging.export-results")}
							</button>
						)}
						{results.data && (
							<button
								type="button"
								className="ui-button"
								onClick={() =>
									downloadCsv(
										"judging-projects.csv",
										results.data.projectRoster.map(item => ({
											project_name: item.projectName,
											table_number: item.tableNumber,
											room: item.room,
											main_track: item.mainTrack,
											category_opt_ins: item.categoryOptIns,
											devpost_url: item.devpostUrl,
											devpost_project_id: item.devpostProjectId,
										})),
									)
								}
							>
								{t("judging.export-projects")}
							</button>
						)}
						{results.data && (
							<>
								<h3 className="text-xl font-bold">{t("judging.benchmarks")}</h3>
								<div className="overflow-x-auto">
									<table className="w-full text-left">
										<thead>
											<tr>
												<th>{t("judging.judge")}</th>
												<th>{t("judging.projects-heading")}</th>
												<th>{t("judging.scopes")}</th>
												<th>{t("judging.average")}</th>
												<th>{t("judging.spread")}</th>
												<th>{t("judging.co-judge-difference")}</th>
												<th>{t("judging.rank-agreement")}</th>
												<th>{t("judging.overlap")}</th>
											</tr>
										</thead>
										<tbody>
											{results.data.benchmarks.map(item => (
												<tr key={item.judgeId} className="border-t">
													<td>{item.judgeName}</td>
													<td>{item.projectCount}</td>
													<td>
														{item.completeCount}/{item.scopeCount}
													</td>
													<td>{item.averageScore ?? "—"}</td>
													<td>{item.scoreSpread ?? "—"}</td>
													<td>{item.meanDifferenceFromCoJudges ?? "—"}</td>
													<td>{item.rankAgreement ?? "—"}</td>
													<td>
														{item.insufficientOverlap
															? t("judging.insufficient-overlap")
															: item.sharedAssessments}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<div className="overflow-x-auto sm:col-span-3">
									<h3 className="mb-2 text-lg font-bold">{t("judging.category-cohorts")}</h3>
									<table className="w-full text-left">
										<thead>
											<tr>
												<th>{t("judging.category")}</th>
												<th>{t("judging.judges-heading")}</th>
												<th>{t("judging.projects-heading")}</th>
												<th>{t("judging.assignments-heading")}</th>
												<th>{t("judging.anchors")}</th>
											</tr>
										</thead>
										<tbody>
											{previewCohorts.map(cohort => (
												<tr key={cohort.categoryCode} className="border-t">
													<td>{cohort.categoryCode}</td>
													<td>{cohort.judges.join(", ")}</td>
													<td>{cohort.projects}</td>
													<td>{cohort.assignments}</td>
													<td>{cohort.anchors}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</>
						)}
					</section>
				) : (
					!overview.isLoading && <p>{t("judging.no-round")}</p>
				)}
				{mutationError && <Error message={mutationError.message} />}
			</div>
		</App>
	);
}

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return {
		redirect: organizerRedirect(session, "/internal/judging", true),
		props: await serverSideTranslations(locale ?? "en", ["internal", "navbar", "common"]),
	};
};
