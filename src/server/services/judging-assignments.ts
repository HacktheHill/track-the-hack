import type { ImportedJudge, ImportedJudgingProject } from "@/server/services/judging-import";
import { isMiniCategoryCode, type JudgingCategoryCode } from "@/shared/judging";

export type GeneratedAssignment = {
	judgeEmail: string;
	projectExternalId: string;
	categoryCode: JudgingCategoryCode;
	isMain: boolean;
	expertiseMatch: boolean;
	calibrationAnchor: boolean;
	reason: string;
};

export type AssignmentGenerationResult = {
	assignments: GeneratedAssignment[];
	effectiveProjectLimit: number;
	requiresOverloadApproval: boolean;
	warnings: string[];
	errors: string[];
	judgeLoads: Array<{ email: string; projects: number; scopes: number; rooms: string[] }>;
	coverage: Array<{ projectExternalId: string; categoryCode: JudgingCategoryCode; count: number }>;
};

type Scope = {
	project: ImportedJudgingProject;
	categoryCode: JudgingCategoryCode;
	isMain: boolean;
};

type State = {
	assignments: GeneratedAssignment[];
	projectsByJudge: Map<string, Set<string>>;
	scopesByJudge: Map<string, number>;
	roomsByJudge: Map<string, Set<string>>;
};

const buildScopes = (projects: ImportedJudgingProject[]): Scope[] =>
	projects.flatMap(project => {
		const mainScopes: Scope[] =
			project.mainTrack === "CGI" ? [] : [{ project, categoryCode: project.mainTrack, isMain: true }];
		return [...mainScopes, ...project.categories.map(categoryCode => ({ project, categoryCode, isMain: false }))];
	});

const eligible = (judge: ImportedJudge, scope: Scope) => !judge.exclusions.includes(scope.categoryCode);

const hasAssignment = (state: State, judgeEmail: string, scope: Scope) =>
	state.assignments.some(
		assignment =>
			assignment.judgeEmail === judgeEmail &&
			assignment.projectExternalId === scope.project.externalId &&
			assignment.categoryCode === scope.categoryCode,
	);

const candidateCost = (state: State, judge: ImportedJudge, scope: Scope, projectLimit: number) => {
	const projects = state.projectsByJudge.get(judge.email) ?? new Set<string>();
	const alreadyVisits = projects.has(scope.project.externalId);
	if (!alreadyVisits && projects.size >= projectLimit) return Number.POSITIVE_INFINITY;
	if (!eligible(judge, scope) || hasAssignment(state, judge.email, scope)) return Number.POSITIVE_INFINITY;
	const expertiseCost = scope.isMain
		? 0
		: isMiniCategoryCode(scope.categoryCode) && judge.expertise.includes(scope.categoryCode)
			? -1000
			: judge.expertise.length === 0
				? 0
				: 500;
	const rooms = state.roomsByJudge.get(judge.email) ?? new Set<string>();
	const roomCost = rooms.size === 0 || rooms.has(scope.project.room) ? 0 : 20;
	return (
		expertiseCost +
		(alreadyVisits ? -180 : 0) +
		projects.size * 100 +
		(state.scopesByJudge.get(judge.email) ?? 0) * 5 +
		roomCost
	);
};

const assign = (state: State, judge: ImportedJudge, scope: Scope, reason: string, calibrationAnchor = false) => {
	state.assignments.push({
		judgeEmail: judge.email,
		projectExternalId: scope.project.externalId,
		categoryCode: scope.categoryCode,
		isMain: scope.isMain,
		expertiseMatch:
			!scope.isMain && isMiniCategoryCode(scope.categoryCode) && judge.expertise.includes(scope.categoryCode),
		calibrationAnchor,
		reason,
	});
	const projects = state.projectsByJudge.get(judge.email) ?? new Set<string>();
	projects.add(scope.project.externalId);
	state.projectsByJudge.set(judge.email, projects);
	state.scopesByJudge.set(judge.email, (state.scopesByJudge.get(judge.email) ?? 0) + 1);
	const rooms = state.roomsByJudge.get(judge.email) ?? new Set<string>();
	rooms.add(scope.project.room);
	state.roomsByJudge.set(judge.email, rooms);
};

const emptyState = (judges: ImportedJudge[]): State => ({
	assignments: [],
	projectsByJudge: new Map(judges.map(judge => [judge.email, new Set<string>()])),
	scopesByJudge: new Map(judges.map(judge => [judge.email, 0])),
	roomsByJudge: new Map(judges.map(judge => [judge.email, new Set<string>()])),
});

const chooseJudge = (state: State, judges: ImportedJudge[], scope: Scope, projectLimit: number) =>
	judges
		.map(judge => ({ judge, cost: candidateCost(state, judge, scope, projectLimit) }))
		.filter(candidate => Number.isFinite(candidate.cost))
		.sort((a, b) => a.cost - b.cost || a.judge.email.localeCompare(b.judge.email))[0]?.judge;

const candidateCount = (judges: ImportedJudge[], scope: Scope) => judges.filter(judge => eligible(judge, scope)).length;

const generateBaseline = (projects: ImportedJudgingProject[], judges: ImportedJudge[], projectLimit: number) => {
	const state = emptyState(judges);
	const scopes = buildScopes(projects).sort((a, b) => {
		const candidates = candidateCount(judges, a) - candidateCount(judges, b);
		if (candidates !== 0) return candidates;
		if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
		return a.project.tableNumber - b.project.tableNumber || a.categoryCode.localeCompare(b.categoryCode);
	});
	const uncovered: Scope[] = [];
	for (const scope of scopes) {
		const judge = chooseJudge(state, judges, scope, projectLimit);
		if (!judge) uncovered.push(scope);
		else assign(state, judge, scope, scope.isMain ? "baseline main-track coverage" : "baseline category coverage");
	}
	if (uncovered.length > 0) {
		const exact = generateWholeProjectBaseline(scopes, judges, projectLimit);
		if (exact) return { state: exact, scopes, uncovered: [] };
	}
	return { state, scopes, uncovered };
};

/**
 * The preference-driven scope-by-scope pass above can paint itself into a
 * corner even when a complete schedule exists. When every scope on a project
 * can be covered by one judge, solve the project-capacity problem exactly as a
 * deterministic bipartite matching before concluding that the cap must rise.
 */
const generateWholeProjectBaseline = (scopes: Scope[], judges: ImportedJudge[], projectLimit: number) => {
	const scopesByProject = Map.groupBy(scopes, scope => scope.project.externalId);
	const scopedProjects = [...scopesByProject.entries()].map(([projectId, projectScopes]) => ({
		projectId,
		project: projectScopes[0]?.project,
		scopes: projectScopes,
		eligibleJudges: judges
			.filter(judge => projectScopes.every(scope => eligible(judge, scope)))
			.sort((a, b) => {
				const aMatches = projectScopes.filter(
					scope => isMiniCategoryCode(scope.categoryCode) && a.expertise.includes(scope.categoryCode),
				).length;
				const bMatches = projectScopes.filter(
					scope => isMiniCategoryCode(scope.categoryCode) && b.expertise.includes(scope.categoryCode),
				).length;
				return bMatches - aMatches || a.email.localeCompare(b.email);
			}),
	}));
	if (scopedProjects.some(project => !project.project || project.eligibleJudges.length === 0)) return null;

	const orderedProjects = [...scopedProjects].sort(
		(a, b) =>
			a.eligibleJudges.length - b.eligibleJudges.length ||
			b.scopes.length - a.scopes.length ||
			(a.project?.tableNumber ?? 0) - (b.project?.tableNumber ?? 0) ||
			a.projectId.localeCompare(b.projectId),
	);
	const slotKeys = judges.flatMap(judge =>
		Array.from({ length: projectLimit }, (_, index) => `${judge.email}\u0000${index}`),
	);
	const projectById = new Map(orderedProjects.map(project => [project.projectId, project]));
	const projectBySlot = new Map<string, string>();
	const slotJudge = new Map(slotKeys.map(key => [key, key.slice(0, key.lastIndexOf("\u0000"))]));

	const findSlot = (projectId: string, seenSlots: Set<string>): boolean => {
		const project = projectById.get(projectId);
		if (!project) return false;
		for (const judge of project.eligibleJudges) {
			for (let index = 0; index < projectLimit; index += 1) {
				const slot = `${judge.email}\u0000${index}`;
				if (seenSlots.has(slot)) continue;
				seenSlots.add(slot);
				const occupyingProject = projectBySlot.get(slot);
				if (!occupyingProject || findSlot(occupyingProject, seenSlots)) {
					projectBySlot.set(slot, projectId);
					return true;
				}
			}
		}
		return false;
	};

	for (const project of orderedProjects) {
		if (!findSlot(project.projectId, new Set())) return null;
	}

	const judgeByProject = new Map<string, ImportedJudge>();
	for (const [slot, projectId] of projectBySlot) {
		const email = slotJudge.get(slot);
		const judge = judges.find(candidate => candidate.email === email);
		if (judge) judgeByProject.set(projectId, judge);
	}
	if (judgeByProject.size !== orderedProjects.length) return null;

	const state = emptyState(judges);
	for (const scope of scopes) {
		const judge = judgeByProject.get(scope.project.externalId);
		if (!judge) return null;
		assign(state, judge, scope, scope.isMain ? "baseline main-track coverage" : "baseline category coverage");
	}
	return state;
};

const addRedundancy = (state: State, scopes: Scope[], judges: ImportedJudge[], preferredLimit: number) => {
	const anchorCounts = new Map<JudgingCategoryCode, number>();
	for (const targetCount of [2, 3]) {
		for (const scope of [...scopes].sort((a, b) => {
			if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
			return a.categoryCode.localeCompare(b.categoryCode) || a.project.tableNumber - b.project.tableNumber;
		})) {
			const currentCount = state.assignments.filter(
				assignment =>
					assignment.categoryCode === scope.categoryCode &&
					assignment.projectExternalId === scope.project.externalId,
			).length;
			if (currentCount >= targetCount) continue;
			const judge = chooseJudge(state, judges, scope, preferredLimit);
			if (!judge) continue;
			const calibrationAnchor =
				!scope.isMain && targetCount === 2 && (anchorCounts.get(scope.categoryCode) ?? 0) < 3;
			assign(
				state,
				judge,
				scope,
				targetCount === 2 ? "balanced second assessment" : "balanced third assessment",
				calibrationAnchor,
			);
			if (calibrationAnchor)
				anchorCounts.set(scope.categoryCode, (anchorCounts.get(scope.categoryCode) ?? 0) + 1);
		}
	}
};

export const generateJudgingAssignments = (
	projects: ImportedJudgingProject[],
	judges: ImportedJudge[],
	preferredProjectLimit = 15,
): AssignmentGenerationResult => {
	if (projects.length === 0)
		return {
			assignments: [],
			effectiveProjectLimit: preferredProjectLimit,
			requiresOverloadApproval: false,
			warnings: [],
			errors: ["At least one project is required."],
			judgeLoads: [],
			coverage: [],
		};
	if (judges.length === 0)
		return {
			assignments: [],
			effectiveProjectLimit: preferredProjectLimit,
			requiresOverloadApproval: false,
			warnings: [],
			errors: ["At least one judge is required."],
			judgeLoads: [],
			coverage: [],
		};

	let effectiveProjectLimit = preferredProjectLimit;
	let generated = generateBaseline(projects, judges, effectiveProjectLimit);
	while (generated.uncovered.length > 0 && effectiveProjectLimit < projects.length) {
		effectiveProjectLimit += 1;
		generated = generateBaseline(projects, judges, effectiveProjectLimit);
	}
	const errors = generated.uncovered.map(
		scope => `No eligible judge can cover table ${scope.project.tableNumber} for ${scope.categoryCode}.`,
	);
	if (errors.length === 0) addRedundancy(generated.state, generated.scopes, judges, preferredProjectLimit);

	const warnings: string[] = [];
	if (effectiveProjectLimit > preferredProjectLimit)
		warnings.push(
			`Complete baseline coverage requires up to ${effectiveProjectLimit} projects per judge; administrator approval is required.`,
		);
	for (const assignment of generated.state.assignments) {
		if (!assignment.isMain && !assignment.expertiseMatch) {
			const judge = judges.find(candidate => candidate.email === assignment.judgeEmail);
			if (judge?.expertise.length)
				warnings.push(`${judge.name} is a non-expert fallback for ${assignment.categoryCode}.`);
		}
	}

	const coverageMap = new Map<
		string,
		{ projectExternalId: string; categoryCode: JudgingCategoryCode; count: number }
	>();
	for (const assignment of generated.state.assignments) {
		const key = `${assignment.projectExternalId}:${assignment.categoryCode}`;
		const current = coverageMap.get(key);
		coverageMap.set(key, {
			projectExternalId: assignment.projectExternalId,
			categoryCode: assignment.categoryCode,
			count: (current?.count ?? 0) + 1,
		});
	}
	for (const [categoryCode, categoryAssignments] of Map.groupBy(
		generated.state.assignments,
		assignment => assignment.categoryCode,
	)) {
		const categoryJudges = new Set(categoryAssignments.map(assignment => assignment.judgeEmail));
		if (categoryJudges.size > 1) {
			const projectJudges = new Map<string, Set<string>>();
			for (const assignment of categoryAssignments) {
				const set = projectJudges.get(assignment.projectExternalId) ?? new Set<string>();
				set.add(assignment.judgeEmail);
				projectJudges.set(assignment.projectExternalId, set);
			}
			if (![...projectJudges.values()].some(set => set.size > 1))
				warnings.push(`${categoryCode} has multiple judge cohorts but insufficient overlap for calibration.`);
		}
	}

	return {
		assignments: generated.state.assignments,
		effectiveProjectLimit,
		requiresOverloadApproval: effectiveProjectLimit > preferredProjectLimit,
		warnings: [...new Set(warnings)],
		errors,
		judgeLoads: judges.map(judge => ({
			email: judge.email,
			projects: generated.state.projectsByJudge.get(judge.email)?.size ?? 0,
			scopes: generated.state.scopesByJudge.get(judge.email) ?? 0,
			rooms: [...(generated.state.roomsByJudge.get(judge.email) ?? [])].sort(),
		})),
		coverage: [...coverageMap.values()].sort(
			(a, b) =>
				a.categoryCode.localeCompare(b.categoryCode) || a.projectExternalId.localeCompare(b.projectExternalId),
		),
	};
};
