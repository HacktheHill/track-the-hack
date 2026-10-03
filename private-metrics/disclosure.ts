// Reviewed per metric, not a global slider. Low-frequency countries and public
// project tags carry useful geographic/technical reach; precise locations and
// sensitive demographic/health categories retain the conservative default.
export const minimumCategorySize = (key: string): number => {
	if (["staffRoles", "missingWalkInAnswers"].includes(key)) return 1;
	if (
		[
			"country",
			"countryRegion",
			"travelRegion",
			"travelCountry",
			"preferredLanguage",
			"acquisitionChannel",
			"priorHackathon",
			"priorHackathonCount",
			"graduationYear",
			"tShirtSize",
			"teamSizes",
			"programmingLanguages",
			"technologies",
			"prizes",
			"profileAvailability",
			"attendanceMode",
			"loginProviders",
		].includes(key)
	)
		return 1;
	if (["school", "studyLevel", "areaOfStudy", "discipline", "transportSchools"].includes(key)) return 2;
	return 5;
};
