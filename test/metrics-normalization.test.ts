import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeCategory,
	programDiscipline,
	displayCategory,
	normalizationSummary,
	categorySelections,
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

void test("demographic, language and logistics aliases preserve distinct identities and health meanings", () => {
	for (const value of ["Men", "Man", "Homme", "Male"]) assert.equal(normalizeCategory("gender", value), "Man");
	for (const value of ["Women", "Woman", "Femme", "Female"])
		assert.equal(normalizeCategory("gender", value), "Woman");
	assert.equal(normalizeCategory("gender", "il/lui"), "He/him (pronouns)");
	assert.notEqual(normalizeCategory("gender", "He/Him"), normalizeCategory("gender", "Man"));
	assert.equal(normalizeCategory("gender", "Woman, Non-binary"), normalizeCategory("gender", "Non binaire, Femme"));
	assert.equal(displayCategory("gender", "Man", "fr"), "Homme");
	assert.equal(
		normalizeCategory("racialOrEthnicBackground", "White, East Asian"),
		normalizeCategory("racialOrEthnicBackground", "eastAsian, Personne blanche"),
	);
	assert.equal(
		normalizeCategory(
			"racialOrEthnicBackground",
			"Indigenous, including First Nations, Métis and Inuit, South Asian",
		),
		"Indigenous, including First Nations, Métis and Inuit + South Asian",
	);
	assert.notEqual(
		normalizeCategory("racialOrEthnicBackground", "middleEastern"),
		normalizeCategory("racialOrEthnicBackground", "Middle Eastern / North African / West Asian"),
	);
	assert.notEqual(
		normalizeCategory("racialOrEthnicBackground", "african"),
		normalizeCategory("racialOrEthnicBackground", "Black or of African descent"),
	);
	assert.equal(normalizeCategory("preferredLanguage", "FR"), normalizeCategory("preferredLanguage", "Français"));
	assert.equal(displayCategory("preferredLanguage", "English", "fr"), "Anglais");
	assert.equal(
		normalizeCategory("studyLevel", "Études universitaires de premier cycle — programme de trois ans ou plus"),
		"Undergraduate",
	);
	assert.equal(normalizeCategory("dietaryRestrictions", "Alimentation halal"), "Halal");
	assert.equal(normalizeCategory("dietaryWithCheckIn", "none"), "No restrictions reported");
	assert.notEqual(
		normalizeCategory("dietaryRestrictions", "Intolérance au lactose"),
		normalizeCategory("dietaryRestrictions", "Allergie au lait"),
	);
	assert.notEqual(
		normalizeCategory("dietaryRestrictions", "nuts"),
		normalizeCategory("dietaryRestrictions", "Peanut allergy"),
	);
	assert.deepEqual(categorySelections("dietaryRestrictions", "Halal, Alimentation halal, Vegetarian"), [
		"Halal",
		"Vegetarian",
	]);
	assert.equal(normalizeCategory("gender", "Unreviewed identity, Woman"), "Unreviewed identity, Woman");
	assert.equal(normalizeCategory("attendanceMode", "IN_PERSON"), "In person");
	assert.equal(displayCategory("priorHackathon", "First-timer", "fr"), "Première participation");
});

void test("Sheet full sweep combines cohorts before suppression and preserves nested option labels", () => {
	const headers = [
		"Submission ID",
		"Admission status",
		"RSVP Status",
		"Attended",
		"Gender identity",
		"Identité de genre",
		"How did you hear about Hack the Hill? Select all that apply. (Search engine (e.g., Google or Bing))",
		"Comment avez-vous entendu parler de Hack the Hill? Sélectionnez toutes les réponses qui s’appliquent. (Moteur de recherche (p. ex. Google ou Bing))",
		"Select all that apply. (Halal)",
		"Si vous avez des restrictions alimentaires ou des allergies, sélectionnez-les ci-dessous: (Alimentation halal)",
		"Quel établissement d’enseignement fréquentez-vous actuellement ou avez-vous fréquenté le plus récemment?",
		"Si votre école ne figure pas dans la liste, indiquez-la ci-dessous:",
	];
	const rows = Array.from({ length: 6 }, (_, i) => [
		`private-${i}`,
		"Accepted",
		"CONFIRMED",
		true,
		i < 3 ? "Man" : "",
		i >= 3 ? "Homme" : "",
		true,
		true,
		true,
		true,
		"École ou organisation non indiquée",
		"Université d’Ottawa",
	]);
	const report = aggregateSheetReport(headers, rows, {
		minimum: minimumCategorySize,
		country: countryLabel,
		languages: () => [],
		normalize: normalizeCategory,
		normalizationSummary,
	});
	assert.deepEqual(report.sheet.dimensions.gender, [
		{ label: "Man", applicants: 6, accepted: 6, confirmed: 6, attended: 6 },
	]);
	assert.equal(report.sheet.dimensions.acquisitionChannel?.find(r => r.label === "Search engine")?.applicants, 6);
	assert.equal(report.sheet.dimensions.dietaryRestrictions?.find(r => r.label === "Halal")?.applicants, 6);
	assert.equal(report.sheet.dimensions.school?.find(r => r.label === "University of Ottawa")?.applicants, 6);
	assert.ok(normalizationSchema.safeParse(report.background.normalization).success);
	assert.doesNotMatch(JSON.stringify(report), /private-|e\.g\.|p\. ex\.|Homme/);
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
