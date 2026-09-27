export type RecusalProject = {
	id: string;
	room: string;
	tableNumber: number;
};

export type RecusalJudge = {
	id: string;
	email: string;
	expertise: string[];
	exclusions: string[];
};

export type RecusalAssignment = {
	id: string;
	projectId: string;
	judgeId: string;
	categoryCode: string;
	isMain: boolean;
	recused: boolean;
};

export type RecusalReplacementPlan = {
	replacements: Array<{ sourceAssignmentId: string; targetJudgeId: string }>;
	errors: string[];
};

const compareNumbers = (left: number[], right: number[]) => {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
};

export const planRecusalReplacements = (input: {
	sourceJudgeId: string;
	projectId: string;
	projects: RecusalProject[];
	judges: RecusalJudge[];
	assignments: RecusalAssignment[];
	projectLimit: number;
}): RecusalReplacementPlan => {
	const projectById = new Map(input.projects.map(project => [project.id, project]));
	const project = projectById.get(input.projectId);
	const sourceScopes = input.assignments
		.filter(
			assignment =>
				assignment.judgeId === input.sourceJudgeId &&
				assignment.projectId === input.projectId &&
				!assignment.recused,
		)
		.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode) || a.id.localeCompare(b.id));
	if (!project)
		return { replacements: [], errors: [`Project ${input.projectId} is missing from the judging round.`] };

	const candidates = input.judges.filter(judge => judge.id !== input.sourceJudgeId);
	const candidateIds = new Set(candidates.map(judge => judge.id));
	const activeAssignments = input.assignments.filter(
		assignment =>
			!assignment.recused &&
			!sourceScopes.some(source => source.id === assignment.id) &&
			candidateIds.has(assignment.judgeId),
	);
	const allAssignmentsByJudgeProject = new Map<string, Set<string>>();
	for (const assignment of input.assignments) {
		const key = `${assignment.judgeId}:${assignment.projectId}`;
		const categories = allAssignmentsByJudgeProject.get(key) ?? new Set<string>();
		categories.add(assignment.categoryCode);
		allAssignmentsByJudgeProject.set(key, categories);
	}
	const projectsByJudge = new Map(candidates.map(judge => [judge.id, new Set<string>()]));
	const scopesByJudge = new Map(candidates.map(judge => [judge.id, 0]));
	for (const assignment of activeAssignments) {
		projectsByJudge.get(assignment.judgeId)?.add(assignment.projectId);
		scopesByJudge.set(assignment.judgeId, (scopesByJudge.get(assignment.judgeId) ?? 0) + 1);
	}

	const expertisePenalty = (judge: RecusalJudge, scope: RecusalAssignment) => {
		if (scope.isMain || judge.expertise.includes(scope.categoryCode)) return 0;
		return judge.expertise.length === 0 ? 1 : 2;
	};
	const routePenalty = (judgeId: string) => {
		const visits = [...(projectsByJudge.get(judgeId) ?? new Set<string>())]
			.map(projectId => projectById.get(projectId))
			.filter((item): item is RecusalProject => Boolean(item));
		const sameRoom = visits.filter(item => item.room === project.room);
		return [
			visits.length === 0 || sameRoom.length > 0 ? 0 : 1,
			sameRoom.length ? Math.min(...sameRoom.map(item => Math.abs(item.tableNumber - project.tableNumber))) : 0,
		];
	};
	const canTake = (judge: RecusalJudge, scopes: RecusalAssignment[]) => {
		if (scopes.some(scope => judge.exclusions.includes(scope.categoryCode))) return false;
		const existingCategories = allAssignmentsByJudgeProject.get(`${judge.id}:${input.projectId}`) ?? new Set();
		if (scopes.some(scope => existingCategories.has(scope.categoryCode))) return false;
		const projects = projectsByJudge.get(judge.id) ?? new Set<string>();
		return projects.has(input.projectId) || projects.size < input.projectLimit;
	};
	const choose = (scopes: RecusalAssignment[]) =>
		candidates
			.filter(judge => canTake(judge, scopes))
			.map(judge => {
				const projects = projectsByJudge.get(judge.id) ?? new Set<string>();
				const alreadyVisits = projects.has(input.projectId);
				return {
					judge,
					priority: [
						scopes.reduce((total, scope) => total + expertisePenalty(judge, scope), 0),
						alreadyVisits ? 0 : 1,
						projects.size + (alreadyVisits ? 0 : 1),
						(scopesByJudge.get(judge.id) ?? 0) + scopes.length,
						...routePenalty(judge.id),
					],
				};
			})
			.sort(
				(a, b) =>
					compareNumbers(a.priority, b.priority) ||
					a.judge.email.localeCompare(b.judge.email) ||
					a.judge.id.localeCompare(b.judge.id),
			)[0]?.judge;
	const record = (judgeId: string, scope: RecusalAssignment) => {
		projectsByJudge.get(judgeId)?.add(input.projectId);
		scopesByJudge.set(judgeId, (scopesByJudge.get(judgeId) ?? 0) + 1);
		const key = `${judgeId}:${input.projectId}`;
		const categories = allAssignmentsByJudgeProject.get(key) ?? new Set<string>();
		categories.add(scope.categoryCode);
		allAssignmentsByJudgeProject.set(key, categories);
	};

	const replacements: RecusalReplacementPlan["replacements"] = [];
	const errors: string[] = [];
	const wholeVisitJudge = choose(sourceScopes);
	if (wholeVisitJudge) {
		for (const scope of sourceScopes) {
			replacements.push({ sourceAssignmentId: scope.id, targetJudgeId: wholeVisitJudge.id });
			record(wholeVisitJudge.id, scope);
		}
		return { replacements, errors };
	}
	for (const scope of sourceScopes) {
		const judge = choose([scope]);
		if (!judge) {
			errors.push(`No eligible replacement is available for ${scope.categoryCode}.`);
			continue;
		}
		replacements.push({ sourceAssignmentId: scope.id, targetJudgeId: judge.id });
		record(judge.id, scope);
	}
	return { replacements, errors };
};
