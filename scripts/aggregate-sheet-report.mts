/**
 * Pure local aggregation. Call with bounded, header-grounded reads; do not save
 * its input. Only category counts and summary statistics leave this function.
 * @param {string[]} headers
 * @param {unknown[][]} input
 * @param {{minimum: (key:string)=>number, country: (label:string, travel?:boolean)=>string|null, languages:(text:string)=>string[]}} policy
 */
export function aggregateSheetReport(
	headers: string[],
	input: unknown[][],
	policy: {
		minimum: (key: string) => number;
		country: (label: string, travel?: boolean) => string | null;
		languages: (text: string) => string[];
	},
) {
	const at = (name: string) => headers.indexOf(name);
	const text = (value: unknown) =>
		String(value ?? "")
			.trim()
			.replace(/\s+/g, " ");
	const cell = (row: unknown[], ...names: string[]) => names.map(name => text(row[at(name)])).find(Boolean) ?? "";
	const rows = input.filter(row => cell(row, "Submission ID"));
	const yes = (value: unknown) => /^(true|yes|oui|1)$/i.test(text(value));
	const flags = (row: unknown[]) => {
		const accepted = /^(accepted|accepté|acceptée)$/i.test(cell(row, "Admission status"));
		return {
			applicants: true,
			accepted,
			confirmed: accepted && cell(row, "RSVP Status") === "CONFIRMED",
			attended: accepted && yes(cell(row, "Attended")),
		};
	};
	const keys = ["applicants", "accepted", "confirmed", "attended"] as const;
	const blank = () => ({ applicants: 0, accepted: 0, confirmed: 0, attended: 0 });
	const cohorts = blank();
	for (const row of rows) for (const key of keys) if (flags(row)[key]) cohorts[key]++;
	const dimensions: Record<
		string,
		Array<{ label: string; applicants: number; accepted: number; confirmed: number; attended: number }>
	> = {};
	const safe = (label: string) => label.length <= 120 && !/@|https?:\/\/|\b\d{7,}\b/i.test(label);
	const dimension = (key: string, choices: (row: unknown[]) => string[]) => {
		const counts = new Map<
			string,
			{ label: string; applicants: number; accepted: number; confirmed: number; attended: number }
		>();
		for (const row of rows) {
			const labels = [...new Set(choices(row).map(text).filter(Boolean))];
			for (const label of labels.length ? labels : ["Not provided"]) {
				const current = counts.get(label.toLowerCase()) ?? { label, ...blank() };
				for (const cohort of keys) if (flags(row)[cohort]) current[cohort]++;
				counts.set(label.toLowerCase(), current);
			}
		}
		const pooled = { label: "Other / suppressed", ...blank() };
		const visible = [];
		for (const row of counts.values()) {
			if (row.label === "Not provided" || (row.applicants >= policy.minimum(key) && safe(row.label)))
				visible.push(row);
			else for (const cohort of keys) pooled[cohort] += row[cohort];
		}
		if (pooled.applicants) visible.push(pooled);
		dimensions[key] = visible.sort((a, b) => b.applicants - a.applicants || a.label.localeCompare(b.label));
	};
	const fields = {
		preferredLanguage: ["Preferred Language / Langue préférée"],
		country: ["Country of residence", "Pays de résidence"],
		gender: ["Gender identity", "Identité de genre"],
		racialOrEthnicBackground: ["Racial or ethnic background", "Origine raciale ou ethnique"],
		studyLevel: [
			"What is your current or most recently completed level of study?",
			"Quel est votre niveau d’études actuel ou le dernier niveau que vous avez terminé?",
		],
		school: [
			"Which school do you currently attend, or which school did you most recently attend?",
			"Quel établissement d’enseignement fréquentez-vous actuellement ou avez-vous fréquenté le plus récemment?",
		],
		areaOfStudy: [
			"What is or was your primary area of study?",
			"Si vous suivez ou avez suivi un programme d’études postsecondaires, quel est ou était votre principal domaine d’études?",
		],
		priorHackathon: ["Have you participated in a hackathon before?", "Avez-vous déjà participé à un hackathon?"],
		travelOrigin: [
			"If accepted, where would you travel from to attend Hack the Hill? Please provide your city, province/state/region, and country.",
			"Si votre candidature est retenue, d’où viendriez-vous pour participer à Hack the Hill? Indiquez votre ville, votre province, votre État ou région, ainsi que votre pays.",
		],
		tShirtSize: ["What unisex T-shirt size would you prefer?", "Quelle taille de t-shirt unisexe préférez-vous?"],
	};
	for (const [key, names] of Object.entries(fields))
		dimension(key, row => {
			let value = cell(row, ...names);
			if (key === "country") value = policy.country(value) ?? (value ? "Unclassified" : "");
			if (key === "priorHackathon")
				value = /^(yes|oui)$/i.test(value) ? "Yes" : /^(no|non)$/i.test(value) ? "No" : value;
			if (
				key === "school" &&
				/^(university of ottawa|université d['’]ottawa|universite d['’]ottawa|uottawa)$/i.test(value)
			)
				value = "University of Ottawa / Université d’Ottawa";
			if (key === "areaOfStudy" && /^(computer science|informatique)$/i.test(value))
				value = "Computer Science / Informatique";
			return [value];
		});
	const age = (row: unknown[]) => {
		const value = cell(row, "Age at the start of Hack the Hill III", "Âge au début de Hack the Hill III");
		return /^\d+$/.test(value) && Number(value) >= 10 && Number(value) <= 100 ? Number(value) : null;
	};
	dimension("age", row => {
		const n = age(row);
		return [n === null ? "" : n < 18 ? "Under 18" : n <= 20 ? "18–20" : n <= 24 ? "21–24" : "25+"];
	});
	dimension("exactAge", row => [age(row) === null ? "" : String(age(row))]);
	dimension("travelCountry", row => {
		const value = cell(row, ...fields.travelOrigin);
		return [policy.country(value, true) ?? (value ? "Unclassified" : "")];
	});
	const options = (prefixes: string[]) =>
		headers.flatMap((header, index) =>
			prefixes.some(prefix => header.startsWith(prefix)) && header.endsWith(")")
				? [{ index, label: header.slice(header.lastIndexOf(" (") + 2, -1) }]
				: [],
		);
	const multiFields: Array<[string, string[]]> = [
		[
			"acquisitionChannel",
			[
				"How did you hear about Hack the Hill? Select all that apply. (",
				"Comment avez-vous entendu parler de Hack the Hill? Sélectionnez toutes les réponses qui s’appliquent. (",
			],
		],
		[
			"dietaryRestrictions",
			[
				"Select all that apply. (",
				"Si vous avez des restrictions alimentaires ou des allergies, sélectionnez-les ci-dessous: (",
			],
		],
	];
	for (const [key, prefixes] of multiFields) {
		const choices = options(prefixes);
		dimension(key, row => {
			const selected = choices
				.filter(option => text(row[option.index]) && !/^(false|no|non|0)$/i.test(text(row[option.index])))
				.map(option => option.label);
			if (
				key === "dietaryRestrictions" &&
				selected.length === 0 &&
				/^(no|non)$/i.test(
					cell(
						row,
						"Do you have any dietary restrictions or food allergies?",
						"Avez-vous des restrictions alimentaires ou des allergies alimentaires?",
					),
				)
			)
				return ["No restrictions reported"];
			return selected;
		});
	}
	const profiles = {
		github: ["GitHub profile", "Profil GitHub"],
		linkedin: ["LinkedIn profile ", "Profil LinkedIn"],
		personalWebsite: ["Personal website or portfolio", "Site web personnel ou portfolio"],
		resume: ["Résumé file", "Résumé link", "Fichier du CV", "Lien vers votre CV"],
	};
	dimension("profileAvailability", row =>
		Object.entries(profiles)
			.filter(([, names]) => cell(row, ...names))
			.map(([label]) => label),
	);
	dimension("programmingLanguages", row => {
		const answer = cell(
			row,
			"What skills, tools, programming languages, or technologies would you bring to a hackathon team?",
			"Quelles compétences, quels outils, quels langages de programmation ou quelles technologies pourriez-vous apporter à une équipe de hackathon?",
		);
		const mentions = policy.languages(answer);
		return !answer ? [] : mentions.length ? mentions : ["No tracked language keywords"];
	});
	const ageStats = keys.map(cohort => {
		const values = rows
			.filter(row => flags(row)[cohort])
			.map(age)
			.filter(value => value !== null)
			.sort((a, b) => a - b);
		const middle = (values.length - 1) / 2;
		const mean = values.reduce((sum, n) => sum + n, 0) / values.length;
		return {
			cohort,
			answered: values.length,
			stdDev:
				values.length >= 5
					? Math.round(
							Math.sqrt(values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (values.length - 1)) * 100,
						) / 100
					: null,
			minimum: values.length >= 5 ? (values[0] ?? null) : null,
			maximum: values.length >= 5 ? (values.at(-1) ?? null) : null,
			under22: values.filter(n => n < 22).length,
			mean:
				values.length >= 5
					? Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 100) / 100
					: null,
			median:
				values.length >= 5 ? ((values[Math.floor(middle)] ?? 0) + (values[Math.ceil(middle)] ?? 0)) / 2 : null,
		};
	});
	const accommodationResponses = rows.filter(row =>
		cell(
			row,
			"Are there any accessibility accommodations that would help you participate fully in the event? If so, please describe them.",
			"Y a-t-il des mesures d’accessibilité ou d’adaptation qui vous aideraient à participer pleinement à l’événement? Si oui, veuillez les décrire.",
		),
	).length;
	return {
		sheet: {
			kind: "google-sheets" as const,
			rows: rows.length,
			linkedRows: rows.filter(row => cell(row, "Participant ID")).length,
			cohorts,
			dimensions,
		},
		background: { ageStats, accommodationResponses },
	};
}
