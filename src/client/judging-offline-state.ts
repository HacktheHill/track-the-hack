export type AssignmentOutboxPatch = {
	kind: "assignment";
	key: string;
	namespace: string;
	operationId: string;
	assignmentId: string;
	editedAt: string;
	fieldEditedAt: Record<string, string>;
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
}: {
	existing?: AssignmentOutboxPatch;
	namespace: string;
	assignmentId: string;
	values: Record<string, unknown>;
	editedAt: string;
	operationId: string;
}): AssignmentOutboxPatch => {
	const fieldEditedAt = { ...(existing?.fieldEditedAt ?? {}) };
	for (const field of Object.keys(values)) fieldEditedAt[field] = editedAt;
	return {
		kind: "assignment",
		key: `${namespace}:assignment:${assignmentId}`,
		namespace,
		operationId,
		assignmentId,
		editedAt,
		fieldEditedAt,
		values: { ...(existing?.values ?? {}), ...values },
	};
};

export const createRankingOutboxPatch = ({
	namespace,
	categoryCode,
	projectIds,
	editedAt,
	operationId,
}: {
	namespace: string;
	categoryCode: string;
	projectIds: string[];
	editedAt: string;
	operationId: string;
}): RankingOutboxPatch => ({
	kind: "ranking",
	key: `${namespace}:ranking:${categoryCode}`,
	namespace,
	operationId,
	categoryCode,
	projectIds,
	editedAt,
});
