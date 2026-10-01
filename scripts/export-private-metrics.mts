import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { createPrismaOperationalMetricsRepository, getOperationalMetrics } from "@/server/services/operational-metrics";
import { archiveDashboardSchema } from "@root/private-metrics/snapshot";

// Read-only export. No participant-level record or credentials leave this process.
const prisma = new PrismaClient();
try {
	const metrics = await getOperationalMetrics(createPrismaOperationalMetricsRepository(prisma));
	const aggregate = archiveDashboardSchema.parse(
		JSON.parse(JSON.stringify({ formatVersion: 1, capturedAt: new Date().toISOString(), metrics })),
	);
	const json = JSON.stringify(aggregate);
	if (process.env.ARCHIVE_EXPORT_LOG_FORMAT === "1") {
		// Bounded lines avoid truncation by container log collectors. The digest
		// lets the local importer reject incomplete or altered log captures.
		const encoded = gzipSync(json).toString("base64");
		const chunks = encoded.match(/.{1,1000}/g) ?? [];
		chunks.forEach((chunk, index) => console.log(`HTH_ARCHIVE_CHUNK ${index} ${chunk}`));
		console.log(`HTH_ARCHIVE_END ${chunks.length} ${createHash("sha256").update(json).digest("hex")}`);
	} else {
		process.stdout.write(json);
	}
} finally {
	await prisma.$disconnect();
}
