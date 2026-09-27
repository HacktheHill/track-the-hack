export type DedicationProject = {
	id: string;
	room: string;
	tableNumber: number;
};

export type DedicationJudge = {
	id: string;
	email: string;
	expertise: string[];
	exclusions: string[];
};

export type DedicationAssignment = {
	id: string;
	projectId: string;
	judgeId: string;
	categoryCode: string;
	isMain: boolean;
};

export type DedicatedCategoryPlan = {
	missingDedicatedProjectIds: string[];
	removeCategoryAssignmentIds: string[];
	reassignments: Array<{ assignmentId: string; targetJudgeId: string }>;
	errors: string[];
};

const compareNumbers = (left: number[], right: number[]) => {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
};

export const planDedicatedCategoryAssignments = (input: {
	dedicatedJudgeId: string;
	categoryCode: string;
	categoryProjectIds: string[];
	projects: DedicationProject[];
	judges: DedicationJudge[];
	assignments: DedicationAssignment[];
	projectLimit: number;
}): DedicatedCategoryPlan => {
	const projectById = new Map(input.projects.map(project => [project.id, project]));
	const candidateById = new Map(input.judges.map(judge => [judge.id, judge]));
	const categoryProjects = new Set(input.categoryProjectIds);
	const removeCategoryAssignments = input.assignments.filter(
		assignment => assignment.categoryCode === input.categoryCode && assignment.judgeId !== input.dedicatedJudgeId,
	);
	const dedicatedOtherAssignments = input.assignments.filter(
		assignment => assignment.judgeId === input.dedicatedJudgeId && assignment.categoryCode !== input.categoryCode,
	);
	const removedIds = new Set([
		...removeCategoryAssignments.map(assignment => assignment.id),
		...dedicatedOtherAssignments.map(assignment => assignment.id),
	]);
	const retainedAssignments = input.assignments.filter(assignment => !removedIds.has(assignment.id));
	const existingDedicatedProjects = new Set(
		retainedAssignments
			.filter(
				assignment =>
					assignment.judgeId === input.dedicatedJudgeId && assignment.categoryCode === input.categoryCode,
			)
			.map(assignment => assignment.projectId),
	);
	const missingDedicatedProjectIds = [...categoryProjects]
		.filter(projectId => !existingDedicatedProjects.has(projectId))
		.sort(
			(a, b) =>
				(projectById.get(a)?.tableNumber ?? 0) - (projectById.get(b)?.tableNumber ?? 0) || a.localeCompare(b),
		);

	const projectsByJudge = new Map<string, Set<string>>();
	const scopesByJudge = new Map<string, number>();
	const categoriesByJudgeProject = new Map<string, Set<string>>();
	for (const judge of input.judges) {
		projectsByJudge.set(judge.id, new Set());
		scopesByJudge.set(judge.id, 0);
	}
	for (const assignment of retainedAssignments) {
		if (!candidateById.has(assignment.judgeId)) continue;
		projectsByJudge.get(assignment.judgeId)?.add(assignment.projectId);
		scopesByJudge.set(assignment.judgeId, (scopesByJudge.get(assignment.judgeId) ?? 0) + 1);
		const key = `${assignment.judgeId}:${assignment.projectId}`;
		const categories = categoriesByJudgeProject.get(key) ?? new Set<string>();
		categories.add(assignment.categoryCode);
		categoriesByJudgeProject.set(key, categories);
	}

	const expertisePenalty = (judge: DedicationJudge, assignment: DedicationAssignment) => {
		if (assignment.isMain) return 0;
		if (judge.expertise.includes(assignment.categoryCode)) return 0;
		return judge.expertise.length === 0 ? 1 : 2;
	};
	const routePenalty = (judgeId: string, project: DedicationProject) => {
		const visits = [...(projectsByJudge.get(judgeId) ?? new Set<string>())]
			.map(projectId => projectById.get(projectId))
			.filter((item): item is DedicationProject => Boolean(item));
		const sameRoom = visits.filter(item => item.room === project.room);
		return [
			visits.length === 0 || sameRoom.length > 0 ? 0 : 1,
			sameRoom.length ? Math.min(...sameRoom.map(item => Math.abs(item.tableNumber - project.tableNumber))) : 0,
		];
	};
	const canTake = (judge: DedicationJudge, projectId: string, scopes: DedicationAssignment[]) => {
		if (scopes.some(scope => judge.exclusions.includes(scope.categoryCode))) return false;
		const existingCategories = categoriesByJudgeProject.get(`${judge.id}:${projectId}`) ?? new Set<string>();
		if (scopes.some(scope => existingCategories.has(scope.categoryCode))) return false;
		const projects = projectsByJudge.get(judge.id) ?? new Set<string>();
		return projects.has(projectId) || projects.size < input.projectLimit;
	};
	const record = (judgeId: string, assignment: DedicationAssignment) => {
		projectsByJudge.get(judgeId)?.add(assignment.projectId);
		scopesByJudge.set(judgeId, (scopesByJudge.get(judgeId) ?? 0) + 1);
		const key = `${judgeId}:${assignment.projectId}`;
		const categories = categoriesByJudgeProject.get(key) ?? new Set<string>();
		categories.add(assignment.categoryCode);
		categoriesByJudgeProject.set(key, categories);
	};
	const choose = (projectId: string, scopes: DedicationAssignment[]) => {
		const project = projectById.get(projectId);
		if (!project) return undefined;
		return input.judges
			.filter(judge => canTake(judge, projectId, scopes))
			.map(judge => {
				const projects = projectsByJudge.get(judge.id) ?? new Set<string>();
				const alreadyVisits = projects.has(projectId);
				return {
					judge,
					priority: [
						scopes.reduce((total, scope) => total + expertisePenalty(judge, scope), 0),
						projects.size + (alreadyVisits ? 0 : 1),
						(scopesByJudge.get(judge.id) ?? 0) + scopes.length,
						alreadyVisits ? 0 : 1,
						...routePenalty(judge.id, project),
					],
				};
			})
			.sort(
				(a, b) =>
					compareNumbers(a.priority, b.priority) ||
					a.judge.email.localeCompare(b.judge.email) ||
					a.judge.id.localeCompare(b.judge.id),
			)[0]?.judge;
	};

	const reassignments: DedicatedCategoryPlan["reassignments"] = [];
	const errors: string[] = [];
	const byProject = Map.groupBy(dedicatedOtherAssignments, assignment => assignment.projectId);
	for (const [projectId, scopes] of [...byProject.entries()].sort(
		(a, b) =>
			(projectById.get(a[0])?.tableNumber ?? 0) - (projectById.get(b[0])?.tableNumber ?? 0) ||
			a[0].localeCompare(b[0]),
	)) {
		const wholeVisitJudge = choose(projectId, scopes);
		if (wholeVisitJudge) {
			for (const scope of scopes) {
				reassignments.push({ assignmentId: scope.id, targetJudgeId: wholeVisitJudge.id });
				record(wholeVisitJudge.id, scope);
			}
			continue;
		}
		for (const scope of [...scopes].sort((a, b) => a.categoryCode.localeCompare(b.categoryCode))) {
			const judge = choose(projectId, [scope]);
			if (!judge) {
				errors.push(`No replacement judge can take ${scope.categoryCode} on project ${projectId}.`);
				continue;
			}
			reassignments.push({ assignmentId: scope.id, targetJudgeId: judge.id });
			record(judge.id, scope);
		}
	}

	return {
		missingDedicatedProjectIds,
		removeCategoryAssignmentIds: removeCategoryAssignments.map(assignment => assignment.id),
		reassignments,
		errors,
	};
};
