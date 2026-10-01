import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import i18next from "i18next";
import { z } from "zod";
import { aggregateProjectInsights } from "@root/scripts/import-historical-devpost.mts";
import { projectInsightsSchema } from "@root/private-metrics/project-insights";
import { HistoricalProjectInsights, ProjectEditionComparison } from "@/components/metrics/HistoricalProjectInsights";
import { privateMetricsFixture } from "./helpers/private-metrics-fixture";

const options = {
	registrants: 30,
	submitters: 20,
	teamUpRequests: 2,
	submittedProjects: 12,
	capturedAt: "2026-10-01T12:00:00.000Z",
	sourceDigest: "0".repeat(64),
};
const rows = () =>
	Array.from({ length: 12 }, (_, index) => ({
		"Submission Url": `https://example.invalid/project-${index}`,
		"Project Status": index === 11 ? "Submitted (Hidden)" : "Submitted (Gallery/Visible)",
		"Project Title": "Private project title",
		"About The Project": "Private description",
		Email: "private@example.invalid",
		"Built With": index < 6 ? "JavaScript, javascript, Python" : "javascript, Rare tag",
		"Opt-In Prizes": index < 6 ? "Track A, Track A, Track B" : "Track A",
		"Additional Team Member Count": index < 5 ? "1" : index < 10 ? "2" : "5",
		'"Try it out" Links': index < 9 ? "https://example.invalid/private-link" : "",
		"Video Demo Link": "",
		"Image Gallery URLs": "",
		"Team Colleges/Universities": "Private school",
	}));
const fixture = () => {
	const data = privateMetricsFixture.history?.editions[0]?.devpost;
	assert.ok(data);
	return structuredClone(data);
};

void test("historical project aggregation deduplicates rows and tags, excludes drafts and retains no project records", () => {
	const input = rows();
	const result = aggregateProjectInsights(
		[
			...input,
			{ ...input[0], "Submission Url": "https://example.invalid/draft", "Project Status": "Draft" },
			{ ...input[0] },
		],
		options,
	);
	assert.equal(result.submittedProjects, 12);
	assert.equal(result.publicProjects, 11);
	assert.equal(result.hiddenProjects, 1);
	assert.equal(result.draftProjects, 1);
	assert.equal(result.duplicateExportRows, 1);
	assert.deepEqual(result.technologies.rows, [
		{ label: "javascript", value: 12 },
		{ label: "python", value: 6 },
		{ label: "rare tag", value: 6 },
	]);
	assert.deepEqual(result.prizes.rows, [
		{ label: "Track A", value: 12 },
		{ label: "Track B", value: 6 },
	]);
	assert.deepEqual(result.teamSizes, [
		{ label: "2", value: 5 },
		{ label: "3", value: 5 },
		{ label: "Other / suppressed", value: 2 },
	]);
	assert.equal(result.teamMemberships, 37, "memberships are not the organizer's 20 unique submitters");
	assert.equal(result.coverage.find(row => row.key === "tryItOut")?.answeredProjects, 9);
	assert.doesNotMatch(
		JSON.stringify(result),
		/Private|private@|https?:|Submission Url|Project Title|project-\d|Email/,
	);
});

void test("rare tags are suppressed and missing team sizes are not invented as solo projects", () => {
	const input = rows();
	assert.ok(input[0]);
	input[0] = {
		...input[0],
		"Built With": "Rare technology",
		"Opt-In Prizes": "Rare prize",
		"Additional Team Member Count": "",
	};
	const result = aggregateProjectInsights(input, options);
	assert.equal(result.technologies.suppressedLabels, 1);
	assert.equal(result.prizes.suppressedLabels, 1);
	assert.equal(result.teamSizeAnsweredProjects, 11);
	assert.equal(result.teamMemberships, 35);
	assert.doesNotMatch(JSON.stringify(result), /Rare technology|Rare prize/);
});

void test("URL-less drafts are counted without guessing identities or entering submitted-project charts", () => {
	const draft = { ...rows()[0], "Submission Url": "", "Project Status": "Draft" };
	const result = aggregateProjectInsights([...rows(), draft, { ...draft }], options);
	assert.equal(result.draftProjects, 2);
	assert.equal(result.duplicateExportRows, 0);
	assert.equal(result.technologies.rows[0]?.value, 12);
	assert.throws(
		() => aggregateProjectInsights([{ ...rows()[0], "Submission Url": "" }, ...rows().slice(1)], options),
		/Missing project key/,
	);
});

void test("project imports fail closed on source drift, unknown statuses, conflicting duplicates and unsafe categories", () => {
	assert.throws(() => aggregateProjectInsights(rows(), { ...options, submittedProjects: 13 }), /source drift/);
	assert.throws(
		() => aggregateProjectInsights([{ ...rows()[0], "Project Status": "Unknown" }], options),
		/unknown project status/,
	);
	assert.throws(
		() => aggregateProjectInsights([...rows(), { ...rows()[0], "Built With": "different" }], options),
		/Conflicting duplicate/,
	);
	assert.throws(
		() =>
			aggregateProjectInsights(
				[{ ...rows()[0], "Built With": "private@example.invalid" }, ...rows().slice(1)],
				options,
			),
		/Unsafe project category/,
	);
	assert.throws(
		() =>
			aggregateProjectInsights(
				[{ ...rows()[0], "Additional Team Member Count": "-1" }, ...rows().slice(1)],
				options,
			),
		/Invalid additional/,
	);
});

void test("project snapshot schema rejects personal fields, small categories and incomplete coverage", () => {
	const data = fixture();
	assert.ok(projectInsightsSchema.safeParse(data).success);
	assert.equal(projectInsightsSchema.safeParse({ ...data, participants: [] }).success, false);
	assert.equal(projectInsightsSchema.safeParse({ ...data, submittedProjects: 11 }).success, false);
	assert.equal(projectInsightsSchema.safeParse({ ...data, coverage: data.coverage.slice(1) }).success, false);
	assert.equal(projectInsightsSchema.safeParse({ ...data, teamMemberships: 10000 }).success, false);
	assert.equal(
		projectInsightsSchema.safeParse({
			...data,
			technologies: { ...data.technologies, rows: [{ label: "Rare", value: 1 }] },
		}).success,
		false,
	);
	assert.equal(
		projectInsightsSchema.safeParse({
			...data,
			technologies: { ...data.technologies, rows: [{ label: "private@example.invalid", value: 7 }] },
		}).success,
		false,
	);
});

void test("historical Devpost CLI preserves its sources and refuses to overwrite mode-600 aggregate outputs", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "hth-historical-devpost-"));
	try {
		const source = path.join(directory, "source.json");
		const csvFile = path.join(directory, "without-pii.csv");
		const output = path.join(directory, "aggregate.json");
		const original = JSON.stringify(privateMetricsFixture);
		writeFileSync(source, original, { mode: 0o600 });
		const input = rows();
		assert.ok(input[0]);
		const fields = Object.keys(input[0]);
		const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
		const csvContent = [
			fields.map(quote).join(","),
			...input.map(row => fields.map(field => quote(z.string().parse(Reflect.get(row, field)))).join(",")),
		].join("\n");
		writeFileSync(csvFile, csvContent, { mode: 0o600 });
		const command = [
			"--import",
			"tsx",
			"scripts/import-historical-devpost.mts",
			"--snapshot",
			source,
			"--output",
			output,
			"--captured-at",
			options.capturedAt,
			...["i", "ii"].flatMap(id => [
				`--${id}-projects`,
				csvFile,
				`--${id}-registrants`,
				"30",
				`--${id}-submitters`,
				"20",
				`--${id}-team-up`,
				"2",
				`--${id}-submitted`,
				"12",
			]),
		];
		const run = () => spawnSync(process.execPath, command, { encoding: "utf8" });
		const result = run();
		assert.equal(result.status, 0, result.stderr);
		assert.equal(statSync(output).mode & 0o777, 0o600);
		const saved = readFileSync(output, "utf8");
		assert.doesNotMatch(saved, /Private project title|Private description|private@example|private-link/);
		assert.equal(readFileSync(source, "utf8"), original);
		assert.equal(readFileSync(csvFile, "utf8"), csvContent);
		assert.notEqual(run().status, 0, "existing output is not replaced");
		assert.equal(readFileSync(output, "utf8"), saved);
		const incremental = path.join(directory, "incremental.json");
		const iiArguments = command.slice(command.indexOf("--ii-projects"));
		const incrementalResult = spawnSync(
			process.execPath,
			[
				"--import",
				"tsx",
				"scripts/import-historical-devpost.mts",
				"--snapshot",
				source,
				"--output",
				incremental,
				"--captured-at",
				options.capturedAt,
				...iiArguments,
			],
			{ encoding: "utf8" },
		);
		assert.equal(incrementalResult.status, 0, incrementalResult.stderr);
		const contents: unknown = JSON.parse(readFileSync(incremental, "utf8"));
		const snapshot = z
			.object({
				history: z.object({ editions: z.array(z.object({ id: z.string(), devpost: projectInsightsSchema })) }),
			})
			.parse(contents);
		assert.deepEqual(
			snapshot.history.editions.find(edition => edition.id === "i")?.devpost,
			fixture(),
			"an omitted edition's snapshot is unchanged",
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

void test("historical project filters and expanded categories survive a data-only refresh in both languages", async t => {
	for (const locale of ["en", "fr"]) {
		const i18n = i18next.createInstance();
		const translation: unknown = JSON.parse(
			readFileSync(new URL(`../public/locales/${locale}/metrics.json`, import.meta.url), "utf8"),
		);
		await i18n.init({
			lng: locale,
			resources: { [locale]: { translation: z.record(z.unknown()).parse(translation) } },
		});
		const data = fixture();
		data.technologies.rows = Array.from({ length: 12 }, (_, index) => ({ label: `Technology ${index}`, value: 5 }));
		let renderer: ReactTestRenderer | undefined;
		await act(() => {
			renderer = create(createElement(HistoricalProjectInsights, { data, t: i18n.t, locale }));
		});
		assert.ok(renderer);
		const rendered = renderer;
		t.after(() => rendered.unmount());
		assert.equal(rendered.root.findAllByType("li").length, 10);
		assert.ok(JSON.stringify(rendered.toJSON()).includes(i18n.t("showAll", { count: 12 })));
		await act(() =>
			z.function().args().returns(z.void()).parse(rendered.root.findByType("button").props.onClick)(),
		);
		await act(() =>
			rendered.update(
				createElement(HistoricalProjectInsights, { data: structuredClone(data), t: i18n.t, locale }),
			),
		);
		assert.equal(rendered.root.findAllByType("li").length, 12);
		assert.doesNotMatch(JSON.stringify(rendered.toJSON()), /history\.project\.|\{\{count\}\}/);
		await act(() =>
			z
				.function()
				.args(z.object({ target: z.object({ value: z.string() }) }))
				.returns(z.void())
				.parse(rendered.root.findByType("select").props.onChange)({ target: { value: "teamSizes" } }),
		);
		await act(() =>
			rendered.update(
				createElement(HistoricalProjectInsights, { data: structuredClone(data), t: i18n.t, locale }),
			),
		);
		assert.equal(rendered.root.findByType("select").props.value, "teamSizes");
		const table = create(
			createElement(ProjectEditionComparison, {
				editions: [
					{ label: "HTH I", data },
					{ label: "HTH II", data },
				],
				t: i18n.t,
			}),
		);
		assert.equal(table.root.findByType("tbody").findAllByType("tr").length, 4);
		table.unmount();
	}
});
