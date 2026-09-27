export const clampJudgingEditTime = (value: string, serverReceiptTime: Date) => {
	const parsed = new Date(value);
	const futureLimit = serverReceiptTime.getTime() + 60_000;
	return parsed.getTime() > futureLimit ? serverReceiptTime : parsed;
};

export const judgingFieldWriteWins = (
	incomingAt: Date,
	incomingOperationId: string,
	existingAt: string | undefined,
	existingOperationId: string | undefined,
) => {
	const existingTime = existingAt ? new Date(existingAt).getTime() : 0;
	return (
		incomingAt.getTime() > existingTime ||
		(incomingAt.getTime() === existingTime && incomingOperationId.localeCompare(existingOperationId ?? "") > 0)
	);
};

export const isJudgingRankingVersionCurrent = (
	submittedAssignmentVersion: number,
	currentAssignmentVersion: number,
) => submittedAssignmentVersion === currentAssignmentVersion;
