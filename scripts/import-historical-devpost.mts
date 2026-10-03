import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import csv from "csvtojson";
import { z } from "zod";
import {
	projectInsightsSchema,
	projectCoverageKeys,
	type ProjectInsights,
} from "@root/private-metrics/project-insights";
import { archiveDashboardSchema } from "@root/private-metrics/snapshot";
import type { CsvRow } from "@/server/services/devpost-metrics-import";
import { normalizeCategory } from "@root/private-metrics/normalization";

type Options = {
	registrants: number;
	submitters: number;
	teamUpRequests: number;
	submittedProjects: number;
	capturedAt: string;
	sourceDigest: string;
};
const text = (value: unknown) => String(value ?? "").trim();
const safeLabel = (value: string) => value.length <= 160 && !/@|https?:\/\/|\b\d{7,}\b/i.test(value);
const statuses = ["Draft", "Submitted (Gallery/Visible)", "Submitted (Hidden)"];
const coverageFields = {
	description: "About The Project",
	tryItOut: '"Try it out" Links',
	video: "Video Demo Link",
	images: "Image Gallery URLs",
	builtWith: "Built With",
	prizeOptIn: "Opt-In Prizes",
	teamSchools: "Team Colleges/Universities",
} as const;

export const aggregateProjectInsights = (input: CsvRow[], options: Options): ProjectInsights => {
	// URLs serve only as local deduplication keys. No titles, narratives, links,
	// identities, timestamps or participant-shaped records are exported.
	const projects = new Map<string, CsvRow>();
	const unkeyedDrafts: CsvRow[] = [];
	let duplicateExportRows = 0;
	for (const row of input) {
		const key = text(row["Submission Url"]);
		const status = text(row["Project Status"]);
		if (!statuses.includes(status) || (!key && status !== "Draft"))
			throw new Error("Missing project key or unknown project status");
		// Devpost leaves URLs empty on drafts. Preserve their row count without
		// guessing identity from titles or deduplicating indistinguishable drafts.
		if (!key) {
			unkeyedDrafts.push(row);
			continue;
		}
		const previous = projects.get(key);
		if (previous) {
			if (JSON.stringify(previous) !== JSON.stringify(row)) throw new Error("Conflicting duplicate project rows");
			duplicateExportRows++;
		} else projects.set(key, row);
	}
	const rows = [...projects.values(), ...unkeyedDrafts];
	const submitted = rows.filter(row => text(row["Project Status"]) !== "Draft");
	if (submitted.length !== options.submittedProjects)
		throw new Error("Project export and organizer submitted total differ; review source drift");
	const selections = (field: string, foldCase = false) => {
		const counts = new Map<string, number>();
		let answeredProjects = 0;
		for (const row of submitted) {
			const choices = new Set(
				text(row[field])
					.split(",")
					.map(value => text(value).normalize("NFKC"))
					.filter(Boolean)
					.map(value => (foldCase ? normalizeCategory("technologies", value.toLowerCase()) : value)),
			);
			if (choices.size) answeredProjects++;
			for (const choice of choices) {
				if (!safeLabel(choice)) throw new Error("Unsafe project category; review the export locally");
				counts.set(choice, (counts.get(choice) ?? 0) + 1);
			}
		}
		return {
			answeredProjects,
			suppressedLabels: 0,
			rows: [...counts]
				.filter(([, value]) => value >= 1)
				.map(([label, value]) => ({ label, value }))
				.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
		};
	};
	const teamCounts = new Map<string, number>();
	let teamMemberships = 0;
	let teamSizeAnsweredProjects = 0;
	for (const row of submitted) {
		const value = text(row["Additional Team Member Count"]);
		if (!value) continue;
		if (!/^\d+$/.test(value) || Number(value) > 98) throw new Error("Invalid additional team-member count");
		const size = Number(value) + 1;
		teamSizeAnsweredProjects++;
		teamMemberships += size;
		teamCounts.set(String(size), (teamCounts.get(String(size)) ?? 0) + 1);
	}
	const teamSizes = [...teamCounts]
		.filter(([, value]) => value >= 1)
		.map(([label, value]) => ({ label, value }))
		.sort((a, b) => Number(a.label) - Number(b.label));
	return projectInsightsSchema.parse({
		kind: "devpost-project-insights",
		...options,
		publicProjects: rows.filter(row => text(row["Project Status"]) === "Submitted (Gallery/Visible)").length,
		hiddenProjects: rows.filter(row => text(row["Project Status"]) === "Submitted (Hidden)").length,
		draftProjects: rows.filter(row => text(row["Project Status"]) === "Draft").length,
		teamMemberships,
		teamSizeAnsweredProjects,
		teamSizes,
		technologies: selections("Built With", true),
		prizes: selections("Opt-In Prizes"),
		coverage: projectCoverageKeys.map(key => ({
			key,
			answeredProjects: submitted.filter(row => text(row[coverageFields[key]])).length,
		})),
		duplicateExportRows,
	});
};

const main = async () => {
	const names = [
		"snapshot",
		"output",
		"captured-at",
		...["i", "ii"].flatMap(id => [
			`${id}-projects`,
			`${id}-aggregate`,
			`${id}-registrants`,
			`${id}-submitters`,
			`${id}-team-up`,
			`${id}-submitted`,
		]),
	];
	const { values } = parseArgs({
		options: Object.fromEntries(names.map(name => [name, { type: "string" as const }])),
		strict: true,
	});
	const required = (name: string) => {
		const value = values[name];
		if (!value) throw new Error(`--${name} is required`);
		return value;
	};
	const integer = (name: string) => {
		const value = required(name);
		if (!/^\d+$/.test(value)) throw new Error(`--${name} must be a non-negative integer`);
		return Number(value);
	};
	const snapshotFile = required("snapshot");
	const output = required("output");
	if (path.resolve(output) === path.resolve(snapshotFile))
		throw new Error("Choose a new output file; preserve the original snapshot");
	const snapshot = archiveDashboardSchema.parse(JSON.parse(readFileSync(snapshotFile, "utf8")));
	if (!snapshot.history) throw new Error("Historical editions are required");
	if (!values["i-projects"] && !values["ii-projects"] && !values["i-aggregate"] && !values["ii-aggregate"])
		throw new Error("At least one historical project export or reviewed page aggregate is required");
	for (const id of ["i", "ii"] as const) {
		if (!values[`${id}-projects`] && !values[`${id}-aggregate`]) continue;
		const edition = snapshot.history.editions.find(edition => edition.id === id);
		if (!edition) throw new Error(`Missing historical edition ${id}`);
		if (values[`${id}-aggregate`]) {
			if (values[`${id}-projects`]) throw new Error(`Choose one project source for edition ${id}`);
			const aggregate = projectInsightsSchema.parse(
				JSON.parse(readFileSync(required(`${id}-aggregate`), "utf8")),
			);
			if (aggregate.sourceMethod !== "organizer-pages")
				throw new Error("Page aggregates must identify their counting method");
			edition.devpost = aggregate;
			continue;
		}
		const file = required(`${id}-projects`);
		const raw = readFileSync(file);
		const parsed: unknown = await csv({ checkType: false, checkColumn: true }).fromString(raw.toString("utf8"));
		const rows = z.array(z.record(z.string())).parse(parsed);
		for (const field of [
			"Submission Url",
			"Project Status",
			"Additional Team Member Count",
			...Object.values(coverageFields),
		])
			if (!rows.length || !Object.hasOwn(rows[0] ?? {}, field))
				throw new Error(`Missing project-export column: ${field}`);
		edition.devpost = aggregateProjectInsights(rows, {
			registrants: integer(`${id}-registrants`),
			submitters: integer(`${id}-submitters`),
			teamUpRequests: integer(`${id}-team-up`),
			submittedProjects: integer(`${id}-submitted`),
			capturedAt: required("captured-at"),
			sourceDigest: createHash("sha256").update(raw).digest("hex"),
		});
	}
	const validated = archiveDashboardSchema.parse(snapshot);
	writeFileSync(output, JSON.stringify(validated, null, 2) + "\n", { mode: 0o600, flag: "wx" });
	console.log(
		"Created a new aggregate-only snapshot with supplied historical Devpost insights; source exports and previous snapshot preserved.",
	);
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
	void main().catch(error => {
		console.error(error instanceof Error ? error.message : "Historical Devpost import failed");
		process.exitCode = 1;
	});
