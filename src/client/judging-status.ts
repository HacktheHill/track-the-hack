export type JudgingProjectStatus =
	| "not-started"
	| "in-progress-synced"
	| "stored-locally"
	| "complete-synced"
	| "waiting-organiser"
	| "recusal-requested"
	| "recusal-accepted";

type StartedAssignment = {
	completedAt: unknown;
	note: string | null;
	rulesConcern: boolean;
	recusalReason: string | null;
	recusedAt: unknown;
	miniEligibility: unknown;
	miniScore: number | null;
	technicalLevel: number | null;
	ideaLevel: number | null;
	designLevel: number | null;
	learningLevel: number | null;
	presentationLevel: number | null;
};

export const isJudgingAssignmentStarted = (assignment: StartedAssignment) =>
	Boolean(
		assignment.completedAt ||
		assignment.note?.trim() ||
		assignment.rulesConcern ||
		assignment.recusalReason?.trim() ||
		assignment.recusedAt ||
		assignment.miniEligibility ||
		assignment.miniScore !== null ||
		assignment.technicalLevel !== null ||
		assignment.ideaLevel !== null ||
		assignment.designLevel !== null ||
		assignment.learningLevel !== null ||
		assignment.presentationLevel !== null,
	);

export const shouldShowJudgingSyncButton = ({
	isOnline,
	outboxCount,
	syncState,
}: {
	isOnline: boolean;
	outboxCount: number;
	syncState: string;
}) => isOnline && (outboxCount > 0 || syncState === "syncing" || syncState === "failed" || syncState === "outdated");

export const shouldShowJudgingAssignment = ({
	complete,
	localOnly,
}: {
	complete: boolean;
	localOnly: boolean;
}) => !complete || localOnly;

export const getJudgingProjectStatus = ({
	localOnly,
	complete,
	allRecused,
	allRecusalsAccepted,
	hasPendingRecusal,
	hasUnresolvedEligibility,
	started,
}: {
	localOnly: boolean;
	complete: boolean;
	allRecused: boolean;
	allRecusalsAccepted: boolean;
	hasPendingRecusal: boolean;
	hasUnresolvedEligibility: boolean;
	started: boolean;
}): JudgingProjectStatus => {
	if (localOnly) return "stored-locally";
	if (allRecused && allRecusalsAccepted) return "recusal-accepted";
	if (allRecused && hasPendingRecusal) return "recusal-requested";
	if (hasPendingRecusal || hasUnresolvedEligibility) return "waiting-organiser";
	if (complete) return "complete-synced";
	if (started) return "in-progress-synced";
	return "not-started";
};
