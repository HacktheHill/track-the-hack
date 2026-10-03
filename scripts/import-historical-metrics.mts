import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { historicalArchiveSchema, type HistoricalEdition } from "@root/private-metrics/history";
import { archiveDashboardSchema } from "@root/private-metrics/snapshot";
import { readSqlTables, type SqlRow } from "./historical-sql.mts";
import { geographicRegion, countryLabel } from "@/components/metrics/aggregate-insights";
import { minimumCategorySize } from "@root/private-metrics/disclosure";
import { z } from "zod";

const text = (value: unknown) => String(value ?? "").trim();
const yes = (value: unknown) => value === 1 || value === "1" || value === true;
const unique = (rows: SqlRow[], field: string) => new Set(rows.map(row => text(row[field])).filter(Boolean)).size;
const count = (rows: SqlRow[], predicate: (row: SqlRow) => boolean) => rows.filter(predicate).length;
const languagePatterns = {
	Python: /python/i,
	Java: /\bjava\b/i,
	JavaScript: /javascript/i,
	HTML: /html/i,
	CSS: /\bcss\b/i,
	SQL: /\bsql\b/i,
	"C#": /c#/i,
	TypeScript: /typescript/i,
	Go: /\bgo\b/i,
	Rust: /\brust\b/i,
	// The notebook omitted case-insensitivity here (31 instead of 432).
	"C++": /c\+\+/i,
	Swift: /\bswift\b/i,
	Kotlin: /\bkotlin\b/i,
};
export const historicalLanguageMentions = (value: string) =>
	Object.entries(languagePatterns)
		.filter(([, pattern]) => pattern.test(value))
		.map(([label]) => label);
const safeLabel = (value: string) => value.length <= 160 && !/@|https?:\/\/|\b\d{7,}\b/.test(value);
const quantile = (values: number[], fraction: number) => {
	const sorted = [...values].sort((a, b) => a - b);
	const index = (sorted.length - 1) * fraction;
	const lower = sorted[Math.floor(index)] ?? 0;
	return lower + ((sorted[Math.ceil(index)] ?? lower) - lower) * (index % 1);
};

export function aggregateHistoricalDump(sql: string, id: "i" | "ii"): HistoricalEdition {
	const tables = readSqlTables(
		sql,
		id === "i"
			? {
					HackerInfo: [
						"submissionID",
						"email",
						"preferredLanguage",
						"gender",
						"university",
						"studyLevel",
						"studyProgram",
						"graduationYear",
						"attendanceType",
						"attendanceLocation",
						"transportationRequired",
						"dietaryRestrictions",
						"accessibilityRequirements",
						"shirtSize",
						"numberOfPreviousHackathons",
						"linkGithub",
						"linkLinkedin",
						"linkPersonalSite",
						"linkResume",
						"lookingForwardTo",
						"formStartDate",
						"formEndDate",
						"confirmed",
						"onlyOnline",
						"walkIn",
					],
					AuditLog: ["timestamp", "action", "details", "user_id"],
					PresenceInfo: ["hackerInfoId", "checkedIn"],
				}
			: {
					Hacker: [
						"id",
						"preferredLanguage",
						"country",
						"gender",
						"raceEthnicity",
						"currentSchoolOrganization",
						"educationLevel",
						"major",
						"hackathonBefore",
						"programmingLanguagesTechnologies",
						"tShirtSize",
						"dietaryRestrictions",
						"specialAccommodations",
						"travelOrigin",
						"referralSource",
						"hasResume",
						"acceptanceStatus",
						"confirmed",
						"walkIn",
						"age",
						"teamId",
						"github",
						"linkedin",
						"personalWebsite",
						"userId",
						"acceptanceReason",
					],
					Presence: ["label", "hackerId", "value", "createdAt", "updatedAt"],
					Event: ["name", "type", "start", "hidden"],
					Team: ["id"],
					Role: ["id", "name"],
					_RoleToUser: ["A", "B"],
					Account: ["userId", "provider"],
					User: ["id", "emailVerified"],
					Log: ["action", "sourceId"],
				},
	);
	const table = (name: string) => tables[name] ?? [];
	const removed = new Set((tables.AuditLog ?? []).filter(row => row.action === "WalkIn").map(row => row.user_id));
	const rows = id === "i" ? table("HackerInfo").filter(row => !removed.has(row.submissionID)) : table("Hacker");
	const field = id === "i" ? "submissionID" : "id";
	const presence = tables.Presence ?? [];
	const checkIds = new Set<string>();
	const anyIds = new Set<string>();
	let restored = 0;
	if (id === "i") {
		const edits = new Map<string, { timestamp: string; value: boolean }>();
		for (const row of table("AuditLog")) {
			if (row.action !== "Presence" || !text(row.timestamp).startsWith("2024-02-03")) continue;
			const changed = / checkedIn updated to (true|false)/.exec(text(row.details));
			if (!changed) continue;
			const key = text(row.user_id);
			if (!edits.has(key) || text(row.timestamp) < (edits.get(key)?.timestamp ?? ""))
				edits.set(key, { timestamp: text(row.timestamp), value: changed[1] === "true" });
		}
		for (const row of table("PresenceInfo")) {
			const key = text(row.hackerInfoId);
			if (removed.has(key)) continue;
			const edit = edits.get(key);
			if (edit ? !edit.value : yes(row.checkedIn)) checkIds.add(key);
		}
		restored = edits.size;
		for (const key of checkIds) anyIds.add(key);
	} else {
		for (const row of presence) {
			anyIds.add(text(row.hackerId));
			if (row.label === "Check-In") checkIds.add(text(row.hackerId));
		}
	}
	const pre = rows.filter(row => !yes(row.walkIn));
	const accepted = pre.filter(row => row.acceptanceStatus === "ACCEPTED");
	const confirmed = (id === "i" ? pre.filter(row => row.attendanceType === "IN_PERSON") : accepted).filter(row =>
		yes(row.confirmed),
	);
	const matched = confirmed.filter(row => checkIds.has(text(row[field])));
	const identities = (population: SqlRow[]) =>
		new Set(population.map(row => text(row.email).toLowerCase()).filter(Boolean)).size;
	const result: HistoricalEdition = {
		id,
		year: id === "i" ? 2023 : 2024,
		sourceDigest: createHash("sha256").update(sql).digest("hex"),
		populations: {
			registrations: rows.length,
			preEvent: pre.length,
			walkIns: rows.length - pre.length,
			identities: id === "i" ? identities(rows) : null,
			checkIn: checkIds.size,
			anyScan: anyIds.size,
		},
		funnel:
			id === "i"
				? [
						{
							key: "applications",
							value: pre.filter(row => row.attendanceType === "IN_PERSON").length,
							unit: "rows",
						},
						{ key: "confirmed", value: confirmed.length, unit: "rows" },
						{ key: "checkedIn", value: matched.length, unit: "rows" },
					]
				: [
						{ key: "applications", value: pre.length, unit: "rows" },
						{ key: "accepted", value: accepted.length, unit: "rows" },
						{ key: "confirmed", value: confirmed.length, unit: "rows" },
						{ key: "checkedIn", value: matched.length, unit: "rows" },
					],
		turnout: {
			from: id === "i" ? identities(confirmed) : confirmed.length,
			to: id === "i" ? identities(matched) : matched.length,
			reconstructed: id === "i",
		},
		dimensions: [],
		events: [],
		mealBounds: [],
		stats: [],
		quality: [],
	};
	const dimension = (
		key: string,
		column: string,
		section: "cohorts" | "operations" | "insights" = "cohorts",
		transform = text,
		population = rows,
	) => {
		const grouped = new Map<string, number>();
		let missing = 0;
		for (const row of population) {
			const label = transform(row[column]);
			if (!label) {
				missing++;
				continue;
			}
			grouped.set(label, (grouped.get(label) ?? 0) + 1);
		}
		let suppressed = 0;
		const values: Array<{ label: string; value: number }> = [];
		for (const [label, value] of grouped) {
			if (value < minimumCategorySize(key) || !safeLabel(label)) suppressed += value;
			else values.push({ label, value });
		}
		if (suppressed) values.push({ label: "Other / suppressed", value: suppressed });
		result.dimensions.push({
			key,
			section,
			total: population.length,
			missing,
			multiSelect: false,
			rows: values.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
		});
	};
	const stat = (key: string, value: number, unit: "count" | "minutes" | "hours" | "years" = "count") =>
		result.stats.push({ key, value: Math.round(value * 100) / 100, unit });
	const quality = (key: string, value: number) => result.quality.push({ key, value });
	for (const [key, column] of id === "i"
		? [
				["gender", "gender"],
				["school", "university"],
				["studyLevel", "studyLevel"],
				["areaOfStudy", "studyProgram"],
				["preferredLanguage", "preferredLanguage"],
				["travelOrigin", "attendanceLocation"],
				["graduationYear", "graduationYear"],
				["priorHackathonCount", "numberOfPreviousHackathons"],
			]
		: [
				["gender", "gender"],
				["school", "currentSchoolOrganization"],
				["studyLevel", "educationLevel"],
				["areaOfStudy", "major"],
				["preferredLanguage", "preferredLanguage"],
				["country", "country"],
				["travelOrigin", "travelOrigin"],
				["racialOrEthnicBackground", "raceEthnicity"],
				["acquisitionChannel", "referralSource"],
			])
		if (key && column && key !== "acquisitionChannel") dimension(key, column);
	// Classify before suppression, without retaining any individual locations.
	dimension("travelCountry", id === "i" ? "attendanceLocation" : "travelOrigin", "cohorts", value => {
		const label = text(value);
		return !label ? "" : (countryLabel(label, true) ?? "Unclassified");
	});
	// Unknown/free-form locations stay unknown; residence never fills travel gaps.
	for (const [key, column] of id === "i"
		? [["travelRegion", "attendanceLocation"]]
		: [
				["countryRegion", "country"],
				["travelRegion", "travelOrigin"],
			]) {
		if (key && column)
			dimension(key, column, "cohorts", value => {
				const label = text(value);
				if (!label) return "";
				const region = geographicRegion(label, key === "travelRegion");
				return region === "canada" ? "Canada" : region === "outside" ? "Outside Canada" : "Unclassified";
			});
	}
	dimension("tShirtSize", id === "i" ? "shirtSize" : "tShirtSize", "operations");
	const dietOptions = ["Halal", "Vegetarian", "Vegan", "Dairy Free", "Gluten Free", "Nut Allergy", "Kosher", "None"];
	const dietCounts = new Map(dietOptions.map(option => [option, 0]));
	let dietMissing = 0;
	for (const row of rows) {
		const value = text(row.dietaryRestrictions);
		if (!value) {
			dietMissing++;
			continue;
		}
		const parts = value.split(",").map(part => part.trim());
		let index = 0;
		while (index < parts.length) {
			const option = dietOptions.find(option => option.toLowerCase() === (parts[index] ?? "").toLowerCase());
			if (!option) break;
			dietCounts.set(option, (dietCounts.get(option) ?? 0) + 1);
			index++;
		}
		if (parts.slice(index).some(Boolean))
			dietCounts.set("Other / suppressed", (dietCounts.get("Other / suppressed") ?? 0) + 1);
	}
	let dietSuppressed = dietCounts.get("Other / suppressed") ?? 0;
	const diets = [...dietCounts].flatMap(([label, value]) => {
		if (label === "Other / suppressed") return [];
		if (value < 5) {
			dietSuppressed += value;
			return [];
		}
		return [{ label, value }];
	});
	if (dietSuppressed) diets.push({ label: "Other / suppressed", value: dietSuppressed });
	result.dimensions.push({
		key: "dietaryRestrictions",
		section: "operations",
		total: rows.length,
		missing: dietMissing,
		multiSelect: true,
		rows: diets,
	});
	if (id === "ii") {
		result.dimensions = result.dimensions.filter(dimension => dimension.key !== "dietaryRestrictions");
		dimension("dietaryRestrictions", "dietaryRestrictions", "operations");
		dimension(
			"dietaryWithCheckIn",
			"dietaryRestrictions",
			"operations",
			text,
			rows.filter(row => checkIds.has(text(row.id))),
		);
		dimension(
			"dietaryWithAnyScan",
			"dietaryRestrictions",
			"operations",
			text,
			rows.filter(row => anyIds.has(text(row.id))),
		);
		const referrals = new Map<string, number>();
		for (const row of rows)
			for (const label of text(row.referralSource)
				.split(",")
				.map(value => value.trim())
				.filter(Boolean))
				referrals.set(label, (referrals.get(label) ?? 0) + 1);
		let small = 0;
		const categories = [...referrals].flatMap(([label, value]) => {
			if (value < minimumCategorySize("acquisitionChannel") || !safeLabel(label)) {
				small += value;
				return [];
			}
			return [{ label, value }];
		});
		if (small) categories.push({ label: "Other / suppressed", value: small });
		result.dimensions.push({
			key: "acquisitionChannel",
			section: "cohorts",
			total: rows.length,
			missing: count(rows, row => !text(row.referralSource)),
			multiSelect: true,
			rows: categories.sort((a, b) => b.value - a.value),
		});
	}
	const accommodations = id === "i" ? "accessibilityRequirements" : "specialAccommodations";
	stat(
		"accommodationResponses",
		count(rows, row => Boolean(text(row[accommodations]))),
	);
	// Never retain accommodation text, profile URLs, programming responses, or audit details.
	const profileFields: Array<[string, string]> =
		id === "i"
			? [
					["github", "linkGithub"],
					["linkedin", "linkLinkedin"],
					["personalWebsite", "linkPersonalSite"],
					["resume", "linkResume"],
				]
			: [
					["github", "github"],
					["linkedin", "linkedin"],
					["personalWebsite", "personalWebsite"],
					["resume", "hasResume"],
				];
	result.dimensions.push({
		key: "profileAvailability",
		section: "insights",
		total: rows.length,
		missing: 0,
		multiSelect: true,
		rows: profileFields.map(([label, column]) => ({
			label,
			value: count(rows, row => (column === "hasResume" ? yes(row[column]) : Boolean(text(row[column])))),
		})),
	});
	if (id === "i") {
		dimension("attendanceMode", "attendanceType", "operations");
		for (const [key, mode] of [
			["inPersonOrigins", "IN_PERSON"],
			["onlineOrigins", "ONLINE"],
		] as const)
			dimension(
				key,
				"attendanceLocation",
				"operations",
				text,
				rows.filter(row => row.attendanceType === mode),
			);
		const walkIns = rows.filter(row => !pre.includes(row));
		result.dimensions.push({
			key: "missingWalkInAnswers",
			section: "insights",
			total: walkIns.length,
			missing: 0,
			multiSelect: true,
			rows: (
				[
					["gender", "gender"],
					["school", "university"],
					["studyLevel", "studyLevel"],
					["areaOfStudy", "studyProgram"],
					["travelOrigin", "attendanceLocation"],
				] as const
			).map(([label, column]) => ({ label, value: count(walkIns, row => !text(row[column])) })),
		});
		stat(
			"lookingForwardResponses",
			count(rows, row => Boolean(text(row.lookingForwardTo))),
		);
		stat(
			"transportRequested",
			count(rows, row => yes(row.transportationRequired)),
		);
		stat(
			"onlineOnly",
			count(rows, row => yes(row.onlyOnline)),
		);
		dimension(
			"transportSchools",
			"university",
			"operations",
			text,
			rows.filter(row => yes(row.transportationRequired)),
		);
		dimension(
			"transportOrigins",
			"attendanceLocation",
			"operations",
			text,
			rows.filter(row => yes(row.transportationRequired)),
		);
		const durations = rows.flatMap(row => {
			if (!row.formStartDate || !row.formEndDate) return [];
			const value =
				(Date.parse(text(row.formEndDate).replace(" ", "T") + "Z") -
					Date.parse(text(row.formStartDate).replace(" ", "T") + "Z")) /
				60_000;
			return Number.isFinite(value) && value >= 0 ? [value] : [];
		});
		const short = durations.filter(value => value <= 60);
		stat("timedForms", durations.length);
		stat("formsWithinHour", short.length);
		stat("formsOverHour", durations.length - short.length);
		if (short.length) {
			stat("formMedian", quantile(short, 0.5), "minutes");
			stat("formMean", short.reduce((sum, value) => sum + value, 0) / short.length, "minutes");
			stat("formP90", quantile(short, 0.9), "minutes");
		}
		const long = durations.filter(value => value > 60);
		if (long.length) {
			stat("longFormMedian", quantile(long, 0.5) / 60, "hours");
			stat("longFormMax", Math.max(...long) / 60, "hours");
		}
		quality("excludedHackHers", removed.size);
		quality("reconstructedRecords", restored);
		quality("duplicateRegistrations", rows.length - identities(rows));
		quality(
			"invalidPriorHackathons",
			count(rows, row => Number(row.numberOfPreviousHackathons) < 0),
		);
	} else {
		dimension("priorHackathon", "hackathonBefore", "cohorts", value =>
			yes(value) ? "Experienced" : "First-timer",
		);
		dimension("age", "age");
		const ages = rows.map(row => Number(row.age)).filter(value => value > 0 && Number.isFinite(value));
		stat("ageMean", ages.reduce((sum, age) => sum + age, 0) / ages.length, "years");
		stat("ageMedian", quantile(ages, 0.5), "years");
		const mean = ages.reduce((sum, age) => sum + age, 0) / ages.length;
		stat(
			"ageStdDev",
			Math.sqrt(ages.reduce((sum, age) => sum + (age - mean) ** 2, 0) / (ages.length - 1)),
			"years",
		);
		stat("ageMinimum", Math.min(...ages), "years");
		stat("ageMaximum", Math.max(...ages), "years");
		stat("ageUnder22", ages.filter(age => age < 22).length);
		stat(
			"confirmedAnyScan",
			count(confirmed, row => anyIds.has(text(row.id))),
		);
		const walkIns = rows.filter(row => yes(row.walkIn));
		stat(
			"walkInCheckIn",
			count(walkIns, row => checkIds.has(text(row.id))),
		);
		stat(
			"walkInAnyScan",
			count(walkIns, row => anyIds.has(text(row.id))),
		);
		stat("linkedPlatformAccounts", unique(rows, "userId"));
		stat(
			"emailVerifiedAccounts",
			count(table("User"), row => Boolean(text(row.emailVerified))),
		);
		const verified = table("Log").filter(row => row.action === "verifyDiscord");
		stat("discordVerificationEvents", verified.length);
		stat("discordVerifiedAccounts", unique(verified, "sourceId"));
		dimension("acceptanceReason", "acceptanceReason", "insights");
		const members = new Map<string, number>();
		for (const row of rows) if (row.teamId) members.set(text(row.teamId), (members.get(text(row.teamId)) ?? 0) + 1);
		const sizes = new Map<number, number>();
		for (const size of members.values()) sizes.set(size, (sizes.get(size) ?? 0) + 1);
		result.dimensions.push({
			key: "teamSizes",
			section: "insights",
			total: members.size,
			missing: 0,
			multiSelect: false,
			rows: [...sizes].map(([size, value]) => ({ label: `${size}`, value })),
		});
		stat("registeredTeams", members.size);
		stat(
			"peopleInTeams",
			count(rows, row => Boolean(row.teamId)),
		);
		stat(
			"peopleWithoutTeam",
			count(rows, row => !row.teamId),
		);
		const languageCounts = new Map(Object.keys(languagePatterns).map(label => [label, 0]));
		for (const row of rows)
			for (const label of historicalLanguageMentions(text(row.programmingLanguagesTechnologies)))
				languageCounts.set(label, (languageCounts.get(label) ?? 0) + 1);
		result.dimensions.push({
			key: "programmingLanguages",
			section: "insights",
			total: rows.length,
			missing: count(rows, row => !text(row.programmingLanguagesTechnologies)),
			multiSelect: true,
			rows: [...languageCounts]
				.map(([label, value]) => ({ label, value }))
				.filter(row => row.value >= minimumCategorySize("programmingLanguages")),
		});
		const events = table("Event").filter(row => text(row.start) > "2000-01-01" && !yes(row.hidden));
		const eventNames = new Map<string, { group: string; instances: number }>();
		for (const row of events) {
			const name = text(row.name);
			const prior = eventNames.get(name);
			eventNames.set(name, { group: text(row.type), instances: (prior?.instances ?? 0) + 1 });
		}
		result.eventGroups = [...new Set(events.map(row => text(row.type)))].map(group => {
			if (!["ALL", "CAREER_FAIR", "FOOD", "SOCIAL", "WORKSHOP"].includes(group))
				throw new Error("Unknown event type");
			const scans = presence.filter(row => eventNames.get(text(row.label))?.group === group);
			return {
				group: z.enum(["ALL", "CAREER_FAIR", "FOOD", "SOCIAL", "WORKSHOP"]).parse(group),
				instances: events.filter(row => text(row.type) === group).length,
				rows: scans.length,
				people: unique(scans, "hackerId"),
				units: scans.reduce((sum, row) => sum + Number(row.value), 0),
			};
		});
		for (const label of new Set(presence.map(row => text(row.label)))) {
			if (label === "Check-In") continue;
			const scans = presence.filter(row => row.label === label);
			const units = new Map<string, number>();
			for (const row of scans)
				units.set(text(row.hackerId), Math.max(units.get(text(row.hackerId)) ?? 0, Number(row.value)));
			const meta = eventNames.get(label);
			result.events.push({
				label,
				group: meta?.group ?? "OTHER",
				instances: meta?.instances ?? 0,
				people: unique(scans, "hackerId"),
				units: [...units.values()].reduce((sum, value) => sum + value, 0),
				checkedInPeople: new Set(scans.filter(row => checkIds.has(text(row.hackerId))).map(row => row.hackerId))
					.size,
			});
		}
		result.events.sort((a, b) => b.people - a.people);
		// Corrected HTH II PDF, printed page 33. These correlated allocation
		// bounds are report-derived, not an exact per-instance SQL measurement.
		const reportedBounds = [
			{ label: "Breakfast", firstMin: 134, firstMax: 137, secondMin: 93, secondMax: 96, floating: 3, total: 230 },
			{ label: "Lunch", firstMin: 275, firstMax: 283, secondMin: 174, secondMax: 182, floating: 8, total: 457 },
			{ label: "Snacks", firstMin: 214, firstMax: 223, secondMin: 223, secondMax: 232, floating: 9, total: 446 },
		];
		for (const bounds of reportedBounds) {
			if (result.events.find(event => event.label === bounds.label)?.units !== bounds.total)
				throw new Error("Report meal totals differ from source SQL");
			result.mealBounds.push(bounds);
		}
		stat("scheduledEvents", events.length);
		stat(
			"foodPeople",
			unique(
				presence.filter(row => eventNames.get(text(row.label))?.group === "FOOD"),
				"hackerId",
			),
		);
		const providers = new Map<string, Set<string>>();
		for (const row of table("Account")) {
			const provider = text(row.provider);
			const set = providers.get(provider) ?? new Set<string>();
			set.add(text(row.userId));
			providers.set(provider, set);
		}
		result.dimensions.push({
			key: "loginProviders",
			section: "insights",
			total: table("User").length,
			missing: 0,
			multiSelect: true,
			rows: [...providers].map(([label, users]) => ({ label, value: users.size })),
		});
		const staffRoles = new Set(
			table("Role")
				.filter(row => ["ORGANIZER", "ADMIN", "ACCEPTANCE"].includes(text(row.name)))
				.map(row => row.id),
		);
		const staff = table("_RoleToUser").filter(row => staffRoles.has(row.A));
		result.dimensions.push({
			key: "staffRoles",
			section: "insights",
			total: table("User").length,
			missing: 0,
			multiSelect: true,
			rows: table("Role")
				.map(role => ({
					label: text(role.name),
					value: unique(
						table("_RoleToUser").filter(row => row.A === role.id),
						"B",
					),
				}))
				.filter(row => row.value > 0),
		});
		stat("staffAssignments", staff.length);
		stat("staffPeople", unique(staff, "B"));
		stat("platformAccounts", table("User").length);
		quality("scanWithoutCheckIn", anyIds.size - checkIds.size);
		quality(
			"confirmedWithoutScan",
			count(confirmed, row => !anyIds.has(text(row.id))),
		);
	}
	const tableColumns = new Map(
		[...sql.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE/g)].map(match => [
			match[1] ?? "",
			[...(match[2] ?? "").matchAll(/^\s*`([^`]+)`/gm)].map(field => field[1] ?? ""),
		]),
	);
	const inventory = readSqlTables(sql, Object.fromEntries([...tableColumns.keys()].map(name => [name, []])));
	const sourceRows = table(id === "i" ? "HackerInfo" : "Hacker");
	// Field coverage uses original raw-table counts, matching the report's
	// structural appendix. Only analytical fields; no credential/contact fields.
	const excludedFields = new Set(["id", "submissionID", "email", "userId", "teamId"]);
	const fields = Object.keys(sourceRows[0] ?? {}).filter(field => !excludedFields.has(field));
	result.sourceInventory = {
		tables: [...tableColumns].map(([label, columns]) => ({
			label,
			columns: columns.length,
			rows: inventory[label]?.length ?? 0,
		})),
		fields: fields.map(label => ({
			label,
			filled: count(sourceRows, row => Boolean(text(row[label]))),
			total: sourceRows.length,
		})),
	};
	const validated = historicalArchiveSchema.parse({ formatVersion: 1, editions: [result] }).editions[0];
	if (!validated) throw new Error("Historical edition is missing");
	return validated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [source, snapshotFile, output] = process.argv.slice(2);
	if (!source || !snapshotFile || !output)
		throw new Error("Usage: import-historical-metrics.mts SOURCE_DIRECTORY SNAPSHOT_JSON OUTPUT_JSON");
	if (path.resolve(snapshotFile) === path.resolve(output))
		throw new Error("Choose a new output file; the original snapshot is preserved.");
	const history = historicalArchiveSchema.parse({
		formatVersion: 1,
		editions: [
			aggregateHistoricalDump(readFileSync(path.join(source, "track-the-hack-2024-04-08.sql"), "utf8"), "i"),
			aggregateHistoricalDump(readFileSync(path.join(source, "track-the-hack-2024-10-02.sql"), "utf8"), "ii"),
		],
	});
	// Cross-check the corrected reports' primary counts, fail closed on source drift.
	const [first, second] = history.editions;
	if (
		first?.populations.registrations !== 1341 ||
		first.populations.identities !== 1259 ||
		first.populations.checkIn !== 377 ||
		second?.populations.registrations !== 1196 ||
		second.populations.checkIn !== 476 ||
		second.populations.anyScan !== 534
	)
		throw new Error("Historical source totals differ from the corrected reports. Review before importing.");
	const previous = archiveDashboardSchema.parse(JSON.parse(readFileSync(snapshotFile, "utf8")));
	for (const edition of history.editions) {
		const devpost = previous.history?.editions.find(old => old.id === edition.id)?.devpost;
		if (devpost) edition.devpost = devpost;
	}
	const aggregate = archiveDashboardSchema.parse({ ...previous, history });
	writeFileSync(output, JSON.stringify(aggregate, null, 2) + "\n", { mode: 0o600, flag: "wx" });
	console.log("Created a new aggregate-only archival snapshot; source SQL and original snapshot were not changed.");
}
