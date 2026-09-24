import type { PrismaClient } from "@prisma/client";

export const AUDIT_RETENTION_DAYS = 90;
export const AUDIT_PURGE_BATCH_SIZE = 1_000;

export const auditRetentionCutoff = (now: Date) =>
	new Date(now.getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1_000);

export const purgeExpiredAuditEvents = async (
	prisma: Pick<PrismaClient, "$executeRaw">,
	now = new Date(),
	batchSize = AUDIT_PURGE_BATCH_SIZE,
) => {
	const cutoff = auditRetentionCutoff(now);
	let deleted = 0;
	for (;;) {
		const count = await prisma.$executeRaw`
			DELETE FROM \`AuditEvent\`
			WHERE \`occurredAt\` < ${cutoff}
			ORDER BY \`occurredAt\`
			LIMIT ${batchSize}
		`;
		deleted += count;
		if (count < batchSize) return { cutoff, deleted };
	}
};
