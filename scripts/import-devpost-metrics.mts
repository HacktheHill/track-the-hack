import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import csv from "csvtojson";
import { z } from "zod";
import { devpostMetricsSnapshotSchema } from "@/server/services/external-metrics";
import { buildDevpostMetricsSnapshot, type CsvRow } from "@/server/services/devpost-metrics-import";

const { values } = parseArgs({
	options: {
		projects: { type: "string" },
		registrants: { type: "string" },
		applications: { type: "string" },
		"active-registrants": { type: "string" },
		submitters: { type: "string" },
		"team-up-requests": { type: "string", default: "0" },
		"captured-at": { type: "string", default: new Date().toISOString() },
		"dry-run": { type: "boolean", default: false },
	},
	strict: true,
});

const requiredPath = (name: "projects" | "registrants" | "applications") => {
	const value = values[name];
	if (!value) throw new Error(`--${name} is required.`);
	return value;
};
const integer = (name: string, value: string | undefined) => {
	if (value === undefined || !/^\d+$/.test(value)) throw new Error(`--${name} must be a non-negative integer.`);
	return Number(value);
};

const capturedAt = new Date(values["captured-at"] ?? "");
if (Number.isNaN(capturedAt.getTime())) throw new Error("--captured-at must be an ISO-8601 timestamp.");
const readCsv = async (path: string): Promise<CsvRow[]> => {
	const parsed: unknown = await csv().fromFile(path);
	const rows = z.array(z.record(z.string(), z.unknown())).parse(parsed);
	return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")])));
};
const [projects, registrants, applications] = await Promise.all([
	readCsv(requiredPath("projects")),
	readCsv(requiredPath("registrants")),
	readCsv(requiredPath("applications")),
]);
const payload = devpostMetricsSnapshotSchema.parse(
	buildDevpostMetricsSnapshot(projects, registrants, applications, {
		activeRegistrants: integer("active-registrants", values["active-registrants"]),
		submitters: integer("submitters", values.submitters),
		teamUpRequests: integer("team-up-requests", values["team-up-requests"]),
	}),
);

if (!values["dry-run"]) {
	const prisma = new PrismaClient();
	try {
		await prisma.metricsSnapshot.upsert({
			where: { source: "devpost" },
			create: { source: "devpost", capturedAt, payload },
			update: { capturedAt, payload },
		});
	} finally {
		await prisma.$disconnect();
	}
}

console.log(
	JSON.stringify({
		kind: values["dry-run"] ? "devpost-metrics-preview" : "devpost-metrics-imported",
		capturedAt: capturedAt.toISOString(),
		registrants: payload.registrants,
		submitters: payload.submitters,
		submittedProjects: payload.submittedProjects,
		matchedRegistrants: payload.linkage.matchedRegistrants,
		matchedSubmitters: payload.linkage.matchedSubmitters,
	}),
);
