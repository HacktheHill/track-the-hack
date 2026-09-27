export type AssignmentOutboxPatch = {
	kind: "assignment";
	key: string;
	namespace: string;
	operationId: string;
	assignmentId: string;
	editedAt: string;
	fieldEditedAt: Record<string, string>;
	fieldOperationIds: Record<string, string>;
	assignmentVersion?: number;
	values: Record<string, unknown>;
};

export type RankingOutboxPatch = {
	kind: "ranking";
	key: string;
	namespace: string;
	operationId: string;
	categoryCode: string;
	projectIds: string[];
	editedAt: string;
	assignmentVersion?: number;
};

export type JudgingOutboxPatch = AssignmentOutboxPatch | RankingOutboxPatch;

export const chunkJudgingOutbox = (entries: JudgingOutboxPatch[], assignmentLimit = 100, rankingLimit = 20) => {
	if (assignmentLimit < 1 || rankingLimit < 1) throw new Error("Judging outbox limits must be positive");
	const assignments = entries.filter((entry): entry is AssignmentOutboxPatch => entry.kind === "assignment");
	const rankings = entries.filter((entry): entry is RankingOutboxPatch => entry.kind === "ranking");
	const batches: Array<{ assignments: AssignmentOutboxPatch[]; rankings: RankingOutboxPatch[] }> = [];
	while (assignments.length || rankings.length) {
		batches.push({
			assignments: assignments.splice(0, assignmentLimit),
			rankings: rankings.splice(0, rankingLimit),
		});
	}
	return batches;
};

export const judgingOfflineNamespace = (roundId: string, judgeId: string, schemaVersion = 1) =>
	`v${schemaVersion}:${roundId}:${judgeId}`;

export const nextEffectiveJudgingEditTime = (candidateMs: number, previousMs?: number) => {
	const effectiveMs = Math.max(candidateMs, previousMs === undefined ? candidateMs : previousMs + 1);
	return { effectiveMs, editedAt: new Date(effectiveMs).toISOString() };
};

export const coalesceAssignmentOutboxPatch = ({
	existing,
	namespace,
	assignmentId,
	values,
	editedAt,
	operationId,
	assignmentVersion,
}: {
	existing?: AssignmentOutboxPatch;
	namespace: string;
	assignmentId: string;
	values: Record<string, unknown>;
	editedAt: string;
	operationId: string;
	assignmentVersion?: number;
}): AssignmentOutboxPatch => {
	const fieldEditedAt = { ...(existing?.fieldEditedAt ?? {}) };
	const fieldOperationIds = { ...(existing?.fieldOperationIds ?? {}) };
	for (const field of Object.keys(values)) {
		fieldEditedAt[field] = editedAt;
		fieldOperationIds[field] = operationId;
	}
	return {
		kind: "assignment",
		key: `${namespace}:assignment:${assignmentId}`,
		namespace,
		operationId,
		assignmentId,
		editedAt,
		fieldEditedAt,
		fieldOperationIds,
		assignmentVersion,
		values: { ...(existing?.values ?? {}), ...values },
	};
};

export const createRankingOutboxPatch = ({
	namespace,
	categoryCode,
	projectIds,
	editedAt,
	operationId,
	assignmentVersion,
}: {
	namespace: string;
	categoryCode: string;
	projectIds: string[];
	editedAt: string;
	operationId: string;
	assignmentVersion?: number;
}): RankingOutboxPatch => ({
	kind: "ranking",
	key: `${namespace}:ranking:${categoryCode}`,
	namespace,
	operationId,
	categoryCode,
	projectIds,
	editedAt,
	assignmentVersion,
});
