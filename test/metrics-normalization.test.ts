import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeCategory,
	programDiscipline,
	displayCategory,
	normalizationSummary,
} from "@root/private-metrics/normalization";
import { normalizationSchema } from "@root/private-metrics/normalization-schema";
import { aggregateSheetReport } from "@root/scripts/aggregate-sheet-report.mts";
import { countryLabel } from "@/components/metrics/aggregate-insights";
import { minimumCategorySize } from "@root/private-metrics/disclosure";

void test("reviewed bilingual aliases normalize without fuzzy inference or campus loss", () => {
	for (const value of ["uOttawa", "The University of Ottawa", " Université d’Ottawa ", "UNIVERSITE D'OTTAWA"])
		assert.equal(normalizeCategory("school", value), "University of Ottawa");
	assert.equal(normalizeCategory("school", "Carleton College"), "Carleton College");
	assert.equal(normalizeCategory("school", "University of Toronto Mississauga"), "University of Toronto Mississauga");
	assert.notEqual(
		normalizeCategory("school", "University of Toronto Mississauga"),
		normalizeCategory("school", "University of Toronto"),
	);
	assert.equal(normalizeCategory("school", "Ryerson University"), "Toronto Metropolitan University");
	assert.equal(normalizeCategory("areaOfStudy", "Génie logiciel"), "Software Engineering");
	assert.equal(normalizeCategory("areaOfStudy", "CS"), "Computer Science");
	assert.notEqual(
		normalizeCategory("areaOfStudy", "Computer Science"),
		normalizeCategory("areaOfStudy", "Software Engineering"),
	);
	assert.equal(programDiscipline("Mathematics and Computer Science"), "Computing and mathematics (joint)");
	assert.equal(programDiscipline("Unreviewed programme"), "Unclassified discipline");
	assert.equal(programDiscipline(""), "");
	assert.equal(normalizeCategory("studyLevel", "2"), "2");
	assert.equal(displayCategory("areaOfStudy", "Software Engineering", "fr"), "Génie logiciel");
	assert.equal(displayCategory("school", "University of Ottawa", "fr"), "Université d’Ottawa");
	assert.equal(displayCategory("discipline", "Engineering", "fr"), "Génie");
	assert.equal(normalizeCategory("technologies", "react-native"), "react-native");
	assert.notEqual(normalizeCategory("technologies", "react-native"), normalizeCategory("technologies", "react"));
	assert.equal(normalizeCategory("technologies", "nextjs"), "next.js");
	assert.equal(normalizeCategory("technologies", "next"), "next");
});

void test("Sheet normalization precedes suppression, uses follow-ups and deduplicates bilingual selections", () => {
	const headers = [
		"Submission ID",
		"Which school do you currently attend, or which school did you most recently attend?",
		"If your school isn't on the list, please enter it below:",
		"What is or was your primary area of study?",
		"How did you hear about Hack the Hill? Select all that apply. (Friend, classmate, or colleague)",
		"Comment avez-vous entendu parler de Hack the Hill? Sélectionnez toutes les réponses qui s’appliquent. (Ami, amie, camarade de classe ou collègue)",
	];
	const rows = [
		["private-one", "University of Ottawa", "", "Computer Science", true, true],
		["private-two", "School/organization not listed", "Université d’Ottawa", "Informatique", false, true],
		["private-three", "Carleton College", "", "Computer Science and Mathematics", false, false],
		["private-four", "", "", "", false, false],
	];
	const result = aggregateSheetReport(headers, rows, {
		minimum: minimumCategorySize,
		country: countryLabel,
		languages: () => [],
		normalize: normalizeCategory,
		discipline: programDiscipline,
		normalizationSummary,
	});
	assert.equal(result.sheet.rows, 4);
	assert.equal(result.sheet.dimensions.school?.find(row => row.label === "University of Ottawa")?.applicants, 2);
	assert.equal(result.sheet.dimensions.school?.find(row => row.label === "Other / suppressed")?.applicants, 1);
	assert.equal(result.sheet.dimensions.school?.find(row => row.label === "Not provided")?.applicants, 1);
	assert.equal(result.sheet.dimensions.areaOfStudy?.find(row => row.label === "Computer Science")?.applicants, 2);
	assert.equal(
		result.sheet.dimensions.discipline?.find(row => row.label === "Computing and information technology")
			?.applicants,
		2,
	);
	assert.equal(
		result.sheet.dimensions.acquisitionChannel?.find(row => row.label === "Friends / classmates / colleagues")
			?.applicants,
		2,
	);
	for (const key of ["school", "areaOfStudy", "discipline"])
		assert.equal(
			result.sheet.dimensions[key]?.reduce((sum, row) => sum + row.applicants, 0),
			4,
		);
	assert.equal(result.background.normalization?.find(row => row.key === "school")?.mergedVariants, 1);
	assert.doesNotMatch(JSON.stringify(result), /private-one|private-two|Carleton College/);
	assert.ok(normalizationSchema.safeParse(result.background.normalization).success);
});

void test("normalization diagnostics preserve missing, unknown and aggregate-only boundaries", () => {
	const summary = normalizationSummary("school", ["uOttawa", "Université d’Ottawa", "", "Ambiguous"]);
	assert.deepEqual(summary, {
		key: "school",
		answered: 3,
		recognized: 2,
		unmapped: 1,
		sourceCategories: 3,
		normalizedCategories: 2,
		mergedVariants: 1,
	});
	const rows = [summary, normalizationSummary("areaOfStudy", []), normalizationSummary("studyLevel", [])];
	assert.ok(normalizationSchema.safeParse(rows).success);
	assert.equal(normalizationSchema.safeParse([{ ...summary, recognized: 99 }, ...rows.slice(1)]).success, false);
	assert.equal(
		normalizationSchema.safeParse([{ ...summary, rawLabels: ["private"] }, ...rows.slice(1)]).success,
		false,
	);
});
