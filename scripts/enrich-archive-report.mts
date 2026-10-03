import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import csv from "csvtojson";
import { z } from "zod";
import { archiveDashboardSchema } from "@root/private-metrics/snapshot";
import { sheetMetricsSnapshotSchema } from "@/server/services/external-metrics";
import { participantBackgroundSchema } from "@root/private-metrics/background";
import { aggregateProjectInsights } from "./import-historical-devpost.mts";

// Inputs are a reviewed aggregate-only Sheet capture and local Devpost exports.
// Raw export records stay inside this process and never become archive fields.
const [snapshotFile, sheetFile, secondProjects, thirdProjects, output] = process.argv.slice(2);
if (!snapshotFile || !sheetFile || !secondProjects || !thirdProjects || !output)
	throw new Error("Expected SNAPSHOT SHEET_AGGREGATE II_PROJECTS III_PROJECTS NEW_OUTPUT");
if ([snapshotFile, sheetFile, secondProjects, thirdProjects].some(file => path.resolve(file) === path.resolve(output)))
	throw new Error("Output must be a new file");
const snapshot = archiveDashboardSchema.parse(JSON.parse(readFileSync(snapshotFile, "utf8")));
const capture = z
	.object({ capturedAt: z.string().datetime(), sheet: sheetMetricsSnapshotSchema, background: z.record(z.unknown()) })
	.strict()
	.parse(JSON.parse(readFileSync(sheetFile, "utf8")));
const background = participantBackgroundSchema.parse({ ...capture.background, capturedAt: capture.capturedAt });
const sheet = capture.sheet;
for (const row of background.ageStats)
	if (row.answered > sheet.cohorts[row.cohort]) throw new Error("Age base exceeds cohort");
snapshot.metrics.externalMetrics.sheet = { capturedAt: capture.capturedAt, payload: sheet };
snapshot.participantBackground = background;
Object.assign(snapshot.metrics.dataQuality, {
	sheetRows: sheet.rows,
	sheetLinkedRows: sheet.linkedRows,
	sheetUnlinkedRows: sheet.rows - sheet.linkedRows,
});
snapshot.metrics.funnel.applications = sheet.cohorts.applicants;
snapshot.metrics.funnel.accepted = sheet.cohorts.accepted;
const conversion = (from: number, to: number) => ({
	from,
	to,
	dropOff: from - to,
	rate: from ? Math.round((to / from) * 1000) / 10 : null,
});
snapshot.metrics.conversions.participation.applicationToAccepted = conversion(
	sheet.cohorts.applicants,
	sheet.cohorts.accepted,
);
snapshot.metrics.conversions.participation.acceptedToConfirmed = conversion(
	sheet.cohorts.accepted,
	snapshot.metrics.confirmed,
);
for (const [id, file] of [
	["ii", secondProjects],
	["iii", thirdProjects],
] as const) {
	const raw = readFileSync(file);
	// The PII export has a variable-length member suffix after its fixed 27
	// project columns (the header ends in "..."). That suffix is irrelevant.
	const input = z
		.array(z.record(z.string()))
		.parse(await csv({ checkType: false, checkColumn: id === "ii" }).fromString(raw.toString("utf8")));
	const fields = [
		"Submission Url",
		"Project Status",
		"Additional Team Member Count",
		"About The Project",
		'"Try it out" Links',
		"Video Demo Link",
		"Image Gallery URLs",
		"Built With",
		"Opt-In Prizes",
		"Team Colleges/Universities",
	];
	for (const row of input)
		for (const field of fields)
			if (!Object.hasOwn(row, field)) throw new Error("Missing fixed project-export column");
	const projected = input.map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? ""])));
	const edition = snapshot.history?.editions.find(e => e.id === "ii");
	const previous = id === "ii" ? edition?.devpost : snapshot.metrics.externalMetrics.devpost?.payload;
	if (!previous) throw new Error("Organizer totals required");
	const capturedAt =
		id === "ii" ? edition?.devpost?.capturedAt : snapshot.metrics.externalMetrics.devpost?.capturedAt;
	if (!capturedAt) throw new Error("Project source date required");
	const insights = aggregateProjectInsights(projected, {
		registrants: previous.registrants,
		submitters: previous.submitters,
		teamUpRequests: previous.teamUpRequests,
		submittedProjects: previous.submittedProjects,
		capturedAt,
		sourceDigest: createHash("sha256").update(raw).digest("hex"),
	});
	if (id === "ii") {
		if (!edition) throw new Error("Missing historical edition");
		edition.devpost = insights;
	} else snapshot.projectInsights = insights;
}
snapshot.capturedAt = capture.capturedAt;
writeFileSync(output, JSON.stringify(archiveDashboardSchema.parse(snapshot), null, 2) + "\n", {
	mode: 0o600,
	flag: "wx",
});
console.log("Created reviewed aggregate archive; previous snapshots and all raw sources preserved.");
