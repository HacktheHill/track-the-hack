import { PrismaClient } from "@prisma/client";
import { purgeExpiredAuditEvents } from "@/server/services/audit-retention";

const prisma = new PrismaClient();

try {
	const result = await purgeExpiredAuditEvents(prisma);
	console.info(
		JSON.stringify({ kind: "track.audit.retention", cutoff: result.cutoff.toISOString(), deleted: result.deleted }),
	);
} finally {
	await prisma.$disconnect();
}
