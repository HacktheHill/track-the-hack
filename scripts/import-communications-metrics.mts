import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { communicationsMetricsSnapshotSchema } from "@/server/services/external-metrics";

const { values } = parseArgs({
	options: {
		"acceptance-ses-accepted": { type: "string" },
		"acceptance-unique-recipients": { type: "string" },
		"bounce-or-complaint-count": { type: "string" },
		"captured-at": { type: "string", default: new Date().toISOString() },
	},
	strict: true,
});

const integer = (name: string, value: string | undefined, required = false) => {
	if (value === undefined && !required) return undefined;
	if (value === undefined || !/^\d+$/.test(value)) throw new Error(`--${name} must be a non-negative integer.`);
	return Number(value);
};

const capturedAt = new Date(values["captured-at"] ?? "");
if (Number.isNaN(capturedAt.getTime())) throw new Error("--captured-at must be an ISO-8601 timestamp.");
const payload = communicationsMetricsSnapshotSchema.parse({
	kind: "communications",
	acceptanceEmailsSesAccepted: integer("acceptance-ses-accepted", values["acceptance-ses-accepted"], true),
	acceptanceUniqueRecipients: integer("acceptance-unique-recipients", values["acceptance-unique-recipients"]),
	bounceOrComplaintCount: integer("bounce-or-complaint-count", values["bounce-or-complaint-count"]),
});

const prisma = new PrismaClient();
try {
	await prisma.metricsSnapshot.upsert({
		where: { source: "communications" },
		create: { source: "communications", capturedAt, payload },
		update: { capturedAt, payload },
	});
	console.log(
		JSON.stringify({
			kind: "communications-metrics-imported",
			capturedAt: capturedAt.toISOString(),
			acceptanceEmailsSesAccepted: payload.acceptanceEmailsSesAccepted,
		}),
	);
} finally {
	await prisma.$disconnect();
}
