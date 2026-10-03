// Versioned, exact reviewed aliases only. No fuzzy matching or inferred campuses.
// Source labels are never exported in diagnostics. Unmapped specifics survive.
export const normalizationVersion = 2;
export const categoryKey = (value: string) =>
	value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[’']/g, "")
		.replace(/[^\p{L}\p{N}+#]+/gu, " ")
		.trim();
type Category = { en: string; fr: string; aliases: string[]; discipline?: string };
const category = (en: string, fr: string, aliases: string[] = [], discipline?: string): Category => ({
	en,
	fr,
	aliases,
	discipline,
});
const schools = [
	category("University of Ottawa", "Université d’Ottawa", [
		"The University of Ottawa",
		"uOttawa",
		"University of Ottawa / Université d’Ottawa",
	]),
	category("Carleton University", "Université Carleton", ["Carleton", "University of Carleton"]),
	category("University of Waterloo", "Université de Waterloo", ["The University of Waterloo"]),
	category("University of Toronto", "Université de Toronto", ["The University of Toronto"]),
	category("University of Toronto Mississauga", "Université de Toronto à Mississauga", [
		"The University of Toronto Mississauga",
		"UTM",
	]),
	category("University of Toronto Scarborough", "Université de Toronto à Scarborough", ["UTSC"]),
	category("Concordia University", "Université Concordia"),
	category("Western University", "Université Western", [
		"University of Western Ontario",
		"The University of Western Ontario",
		"UWO",
	]),
	category("Toronto Metropolitan University", "Université métropolitaine de Toronto", ["Ryerson University", "TMU"]),
	category("Ontario Tech University", "Université Ontario Tech", [
		"University of Ontario Institute of Technology",
		"UOIT",
	]),
	category("University of British Columbia", "Université de la Colombie-Britannique", [
		"The University of British Columbia",
		"UBC",
	]),
	category("Algonquin College", "Collège Algonquin", ["Algonquin College of Applied Arts and Technology"]),
	category("McGill University", "Université McGill"),
	category("McMaster University", "Université McMaster"),
	category("York University", "Université York"),
	category("Queen’s University", "Université Queen’s", ["Queen's University"]),
	category("University of Guelph", "Université de Guelph", ["The University of Guelph"]),
	category("Wilfrid Laurier University", "Université Wilfrid Laurier"),
	category("Trent University", "Université Trent"),
	category("Brock University", "Université Brock"),
	category("Polytechnique Montréal", "Polytechnique Montréal", ["École Polytechnique de Montréal"]),
	category("Université de Montréal", "Université de Montréal", ["University of Montreal", "UdeM"]),
	category("Université du Québec en Outaouais", "Université du Québec en Outaouais", ["UQO"]),
	category("Université du Québec à Montréal", "Université du Québec à Montréal", ["UQAM"]),
	category("Université Laval", "Université Laval", ["Laval University"]),
	category("Université de Sherbrooke", "Université de Sherbrooke", ["University of Sherbrooke"]),
	category("University of Regina", "Université de Regina"),
	category("University of Alberta", "Université de l’Alberta"),
	category("University of Calgary", "Université de Calgary"),
	category("University of Windsor", "Université de Windsor"),
	category("Conestoga College", "Collège Conestoga"),
	category("George Brown College", "Collège George Brown"),
	category("Seneca College", "Collège Seneca"),
	category("Centennial College", "Collège Centennial"),
	category("Sheridan College", "Collège Sheridan"),
	category("John Abbott College", "Collège John Abbott"),
	category("Marianopolis College", "Collège Marianopolis"),
	category("British Columbia Institute of Technology", "British Columbia Institute of Technology", ["BCIT"]),
];
const programs = [
	category(
		"Computer Science",
		"Informatique",
		[
			"CS",
			"Comp sci",
			"Computer Science / Informatique",
			"Computer Science Honours",
			"Bachelors of Computer Science",
			"Bachelor of Computer Science",
		],
		"Computing and information technology",
	),
	category(
		"Software Engineering",
		"Génie logiciel",
		["Software engineer", "BASc in Software Engineering", "Software Engineering (Co-op)"],
		"Computing and information technology",
	),
	category("Computer Engineering", "Génie informatique", ["Computer Eng"], "Computing and information technology"),
	category(
		"Computer Systems Engineering",
		"Génie des systèmes informatiques",
		[],
		"Computing and information technology",
	),
	category(
		"Information Technology",
		"Technologies de l’information",
		["IT", "Technologie de l'information"],
		"Computing and information technology",
	),
	category("Cybersecurity", "Cybersécurité", ["Cyber Security"], "Computing and information technology"),
	category("Computer Programming", "Programmation informatique", [], "Computing and information technology"),
	category(
		"Computer Programming and Analysis",
		"Programmation et analyse informatique",
		[],
		"Computing and information technology",
	),
	category(
		"Computer Engineering Technology",
		"Technologie du génie informatique",
		[],
		"Computing and information technology",
	),
	category("Software Development", "Développement logiciel", [], "Computing and information technology"),
	category("AI Software Development", "Développement logiciel en IA", [], "Computing and information technology"),
	category("Artificial Intelligence", "Intelligence artificielle", [], "Computing and information technology"),
	category(
		"Computer Science and Mathematics",
		"Informatique et mathématiques",
		["Mathematics and Computer Science"],
		"Computing and mathematics (joint)",
	),
	category("Computer Science and Engineering", "Informatique et génie", [], "Computing and engineering (joint)"),
	category(
		"Electrical and Computer Engineering",
		"Génie électrique et informatique",
		[],
		"Computing and engineering (joint)",
	),
	category(
		"Mechanical Engineering and Computing Technology",
		"Génie mécanique et technologie informatique",
		[],
		"Computing and engineering (joint)",
	),
	category(
		"Electrical Engineering and Computing Technology",
		"Génie électrique et technologie informatique",
		[],
		"Computing and engineering (joint)",
	),
	...[
		["Electrical Engineering", "Génie électrique"],
		["Mechanical Engineering", "Génie mécanique"],
		["Civil Engineering", "Génie civil"],
		["Chemical Engineering", "Génie chimique"],
		["Mechatronics Engineering", "Génie mécatronique"],
		["Aerospace Engineering", "Génie aérospatial"],
		["Biomedical Mechanical Engineering", "Génie biomédical mécanique"],
		["Nanotechnology Engineering", "Génie nanotechnologique"],
		["Systems Design Engineering", "Génie de la conception de systèmes"],
		["Engineering Physics", "Génie physique"],
		["Engineering Science", "Sciences du génie"],
	].map(([en = "", fr = ""]) => category(en, fr, [], "Engineering")),
	category("Engineering", "Génie", ["General Engineering"], "Engineering"),
	category("Mathematics", "Mathématiques", ["Math"], "Mathematics and data science"),
	category("Statistics", "Statistique", ["Statistics and Probability"], "Mathematics and data science"),
	category("Data Science", "Science des données", [], "Mathematics and data science"),
	category("Science", "Sciences", [], "Natural and health sciences"),
	category("Biomedical Science", "Sciences biomédicales", [], "Natural and health sciences"),
	category("Biotechnology", "Biotechnologie", [], "Natural and health sciences"),
	category("Biology", "Biologie", [], "Natural and health sciences"),
	category("Physics", "Physique", [], "Natural and health sciences"),
	category("Chemistry", "Chimie", [], "Natural and health sciences"),
	category("Psychology", "Psychologie", [], "Social sciences and humanities"),
	category("Social Science", "Sciences sociales", ["Social Sciences"], "Social sciences and humanities"),
	category("Law", "Droit", [], "Law"),
	category("Civil Law", "Droit civil", [], "Law"),
	category("Commerce", "Commerce", [], "Business and management"),
	category("Business", "Administration des affaires", ["Business Administration"], "Business and management"),
	category("Business Technology Management", "Gestion des technologies d’affaires", [], "Business and management"),
	category(
		"Technology Innovation Management",
		"Gestion de l’innovation technologique",
		[],
		"Business and management",
	),
	category("Interactive Multimedia and Design", "Multimédia interactif et design", [], "Arts and design"),
	category(
		"Not applicable",
		"Sans objet",
		["N/A", "NA", "None", "Not currently a student", "High school"],
		"Not applicable",
	),
];
const levels = [
	category("Undergraduate", "Premier cycle", [
		"University undergraduate program of three years or longer",
		"Études universitaires de premier cycle — programme de trois ans ou plus",
	]),
	category("Graduate / professional", "Études supérieures / professionnelles", [
		"graduate",
		"Graduate (Masters, PhD)",
		"Supérieures",
		"Graduate or professional program (master’s, professional degree, doctorate, etc.)",
		"Études universitaires de cycles supérieurs — maîtrise, programme professionnel, doctorat, etc.",
	]),
	category("Secondary / high school", "Études secondaires", ["highSchool", "Secondary / High School", "Secondaire"]),
	category("College / two-year undergraduate", "Collège / premier cycle de deux ans", [
		"College or two-year undergraduate program",
		"College Diploma",
		"Diploma",
		"Advanced Diploma",
		"Cegep",
		"Cégep",
		"College",
		"Études postsecondaires de premier cycle — programme de deux ans, collège communautaire ou équivalent",
	]),
	category("Below secondary / high school", "Avant les études secondaires", [
		"Less than secondary/high school",
		"Moins que le niveau secondaire",
	]),
	category("Postdoctoral", "Postdoctorat", ["Postdoctoral program or fellowship", "Programme ou stage postdoctoral"]),
	category("Not currently a student", "Pas actuellement aux études", [
		"I'm not currently a student",
		"Je ne suis pas actuellement aux études",
	]),
];
const channels = [
	category("Friends / classmates / colleagues", "Amis / camarades / collègues", [
		"friends",
		"Friend, classmate, or colleague",
		"Ami, amie, camarade de classe ou collègue",
	]),
	category("Student clubs / organizations", "Clubs / organisations étudiantes", [
		"studentOrganizations",
		"Student club or organization",
		"Club ou organisation étudiante",
	]),
	category("Teachers / academic advisers", "Personnel enseignant / conseil pédagogique", [
		"professors",
		"Teacher or academic advisor",
		"Professor, teacher, or academic advisor",
		"Membre du personnel enseignant ou personne conseillère aux études",
	]),
	category("School website", "Site web d’un établissement", [
		"universityWebsite",
		"University or college website",
		"Site web d’un établissement d’enseignement",
	]),
	category("School email", "Courriel d’un établissement", [
		"universityEmail",
		"University or college email",
		"Courriel d’un établissement d’enseignement",
	]),
	category("Campus poster / flyer", "Affiche / dépliant sur le campus", [
		"flyers",
		"Campus poster or flyer",
		"Poster or flyer on campus",
		"Affiche ou dépliant sur le campus",
	]),
	category("Class announcement", "Annonce en classe", ["classAnnouncements", "Annonce en classe"]),
	category("Career services", "Service d’orientation / de carrière", [
		"careerServices",
		"Service d’orientation ou de carrière",
	]),
	category("Alumni network", "Réseau des diplômés", ["alumniNetworks", "Réseau des diplômés et diplômées"]),
	category("Hackathon websites", "Sites web de hackathons", ["hackathonWebsites"]),
	category("Online forums", "Forums en ligne", ["onlineForums"]),
	...["Instagram", "LinkedIn", "TikTok", "Facebook", "Discord", "Reddit"].map(label => category(label, label)),
	category("Major League Hacking (MLH)", "Major League Hacking (MLH)", ["MLH"]),
	category("Search engine", "Moteur de recherche", [
		"Search engine (e.g. Google or Bing)",
		"Search engine (e.g., Google or Bing)",
		"Moteur de recherche (p. ex. Google ou Bing)",
	]),
	category("AI assistant / chatbot", "Assistant d’IA / agent conversationnel", [
		"AI assistant or chatbot (e.g. ChatGPT or Claude)",
		"AI assistant or chatbot (e.g., ChatGPT or Claude)",
		"Assistant d’IA ou agent conversationnel (p. ex. ChatGPT ou Claude)",
	]),
	category("Other", "Autre", ["Other (please specify)", "Autre (veuillez préciser)"]),
];
// Pronouns are not gender identities. Keep the historical pronoun question's
// categories distinct rather than inferring Man/Woman from He/She.
const genders = [
	category("Man", "Homme", ["Men", "Hommes", "Male"]),
	category("Woman", "Femme", ["Women", "Femmes", "Female"]),
	category("Non-binary", "Non binaire", ["nonBinary", "nonbinary", "Non-binaire"]),
	category("Two-Spirit", "Bispirituel·le", ["Two Spirit", "Bispirituel", "Bispirituelle"]),
	category("Another gender identity", "Une autre identité de genre", [
		"Another gender identity (please specify)",
		"Une autre identité de genre (veuillez préciser)",
	]),
	category("Prefer not to answer", "Préfère ne pas répondre", [
		"preferNotToAnswer",
		"Prefer not to say",
		"Je préfère ne pas répondre",
		"Préfère ne pas le dire",
	]),
	category("He/him (pronouns)", "Il/lui (pronoms)", ["He/Him", "il/lui"]),
	category("She/her (pronouns)", "Elle/elle (pronoms)", ["She/Her", "elle/elle"]),
	category("They/them (pronouns)", "Iel (pronoms)", ["They/Them", "iel", "iel/iel"]),
];
const ethnicities = [
	category("South Asian", "Origine sud-asiatique", ["southAsian", "Personne d’Asie du Sud", "Sud-asiatique"]),
	category("East Asian", "Origine est-asiatique", ["eastAsian", "Personne d’Asie de l’Est", "Est-asiatique"]),
	category("Southeast Asian", "Origine sud-est-asiatique", [
		"southeastAsian",
		"Personne d’Asie du Sud-Est",
		"Sud-est-asiatique",
	]),
	category(
		"Middle Eastern / North African / West Asian",
		"Origine moyen-orientale / nord-africaine / ouest-asiatique",
		["Personne du Moyen-Orient, d’Afrique du Nord ou d’Asie occidentale"],
	),
	category("Middle Eastern", "Origine moyen-orientale", ["middleEastern", "Moyen-Orient"]),
	category("North African", "Origine nord-africaine", ["northAfrican", "Afrique du Nord"]),
	category("African", "Origine africaine", ["african", "Africaine", "Africain"]),
	category("Black or of African descent", "Personne noire ou d’ascendance africaine", ["Black or African descent"]),
	category("White", "Personne blanche", ["caucasian", "Caucasian", "Blanc", "Blanche"]),
	category("Latin American / Hispanic", "Origine latino-américaine / hispanique", [
		"Personne d’Amérique latine ou d’origine hispanique",
	]),
	category("Hispanic", "Origine hispanique", ["hispanic", "Hispanique"]),
	category(
		"Indigenous, including First Nations, Métis and Inuit",
		"Autochtone, y compris Premières Nations, Métis et Inuit",
		["Personne autochtone, y compris des Premières Nations, métisse ou inuite"],
	),
	category("Another racial or ethnic background", "Une autre origine raciale ou ethnique", [
		"Another racial or ethnic background (please specify)",
		"Une autre origine raciale ou ethnique (veuillez préciser)",
	]),
	category("Prefer not to answer", "Préfère ne pas répondre", [
		"preferNotToAnswer",
		"Prefer not to say",
		"Je préfère ne pas répondre",
	]),
];
const diets = [
	category("No restrictions reported", "Aucune restriction déclarée", [
		"None",
		"No",
		"Non",
		"Aucune",
		"Aucun",
		"No dietary restrictions",
		"Aucune restriction alimentaire",
	]),
	category("Halal", "Alimentation halal"),
	category("Vegetarian", "Régime végétarien", ["Végétarien", "Végétarienne"]),
	category("Vegan", "Régime végétalien", ["Végétalien", "Végétalienne"]),
	category("Kosher", "Alimentation casher", ["Casher"]),
	category("Gluten-free diet", "Régime sans gluten", [
		"Gluten Free",
		"Gluten-free diet or celiac disease",
		"Régime sans gluten ou maladie cœliaque",
	]),
	category("Dairy-free diet", "Régime sans produits laitiers", ["Dairy Free", "Dairy-free"]),
	category("Lactose intolerance", "Intolérance au lactose", ["lactoseIntolerance"]),
	category("Nut allergy (unspecified)", "Allergie aux noix (non précisée)", ["Nut Allergy", "nuts"]),
	category("Peanut allergy", "Allergie aux arachides"),
	category("Tree nut allergy", "Allergie aux noix autres que les arachides"),
	category("Milk allergy", "Allergie au lait"),
	category("Egg allergy", "Allergie aux œufs"),
	category("Sesame allergy", "Allergie au sésame"),
	category("Soy allergy", "Allergie au soya"),
	category("Wheat allergy", "Allergie au blé"),
	category("Mustard allergy", "Allergie à la moutarde"),
	category("Fish allergy", "Allergie au poisson"),
	category("Crustacean or mollusc allergy", "Allergie aux crustacés ou mollusques"),
	category("Sulphite sensitivity", "Sensibilité aux sulfites"),
	category("Other food allergy or dietary restriction", "Autre allergie ou restriction alimentaire"),
	category("Not applicable", "Sans objet", ["N/A", "NA"]),
];
const preferredLanguages = [
	category("English", "Anglais", ["EN"]),
	category("French", "Français", ["FR", "Français", "Francais"]),
	category("English and French", "Anglais et français", [
		"Bilingual",
		"Bilingue",
		"English / French",
		"Anglais / Français",
	]),
];
const shirts = [
	...["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map(label => category(label, label)),
	category("No T-shirt requested", "Aucun t-shirt demandé", [
		"NONE",
		"I do not want a T-shirt",
		"Je ne souhaite pas de t-shirt",
		"Je ne veux pas de t-shirt",
	]),
];
const dictionaries: Record<string, Category[]> = {
	school: schools,
	transportSchools: schools,
	areaOfStudy: programs,
	studyLevel: levels,
	acquisitionChannel: channels,
	gender: genders,
	racialOrEthnicBackground: ethnicities,
	dietaryRestrictions: diets,
	dietaryWithCheckIn: diets,
	dietaryWithAnyScan: diets,
	preferredLanguage: preferredLanguages,
	tShirtSize: shirts,
	priorHackathon: [
		category("Yes", "Oui", ["true", "1"]),
		category("No", "Non", ["false", "0"]),
		category("First-timer", "Première participation"),
		category("Experienced", "Avec expérience"),
	],
	attendanceMode: [category("In person", "En personne", ["IN_PERSON"]), category("Online", "En ligne", ["ONLINE"])],
	age: [category("Under 18", "Moins de 18 ans"), category("25+", "25 ans et plus")],
};
const technologies = [
	category("next.js", "next.js", ["nextjs"]),
	category("node.js", "node.js", ["nodejs"]),
	category("react", "react", ["reactjs", "react.js"]),
	category("react-native", "react-native", ["react native", "reactnative"]),
	category("tailwindcss", "tailwindcss", ["tailwind", "tailwind-css", "tailwind css"]),
	category("javascript", "javascript", ["java script"]),
	category("typescript", "typescript", ["type script"]),
	category("postgresql", "postgresql", ["postgres"]),
	category("mongodb", "mongodb", ["mongo db"]),
	category("gemini", "gemini", ["google-gemini", "gemini-api", "geminiapi", "google-gemini-api"]),
	category("openai", "openai", ["openai-api", "openaiapi"]),
	category("elevenlabs", "elevenlabs", ["eleven-labs"]),
];
dictionaries.technologies = technologies;
const indices = Object.fromEntries(
	Object.entries(dictionaries).map(([key, entries]) => {
		const index = new Map<string, Category>();
		for (const entry of entries)
			for (const alias of [entry.en, entry.fr, ...entry.aliases]) {
				const normalized = categoryKey(alias);
				if (index.has(normalized) && index.get(normalized)?.en !== entry.en)
					throw new Error(`Conflicting reviewed alias in ${key}`);
				index.set(normalized, entry);
			}
		return [key, index];
	}),
);
const combinationFields = new Set([
	"gender",
	"racialOrEthnicBackground",
	"dietaryRestrictions",
	"dietaryWithCheckIn",
	"dietaryWithAnyScan",
	"acquisitionChannel",
]);
export const normalizationFields = [
	"school",
	"areaOfStudy",
	"studyLevel",
	"gender",
	"racialOrEthnicBackground",
	"preferredLanguage",
	"priorHackathon",
	"tShirtSize",
	"dietaryRestrictions",
	"acquisitionChannel",
	"attendanceMode",
] as const;
// Greedy reviewed phrases keep commas inside an option (e.g. Indigenous) intact.
// Unknown fragments survive; no broad identity/health inference is performed.
export const categorySelections = (key: string, value: string): string[] => {
	const cleaned = value.normalize("NFC").trim().replace(/\s+/g, " ");
	if (!cleaned) return [];
	const exact = indices[key]?.get(categoryKey(cleaned));
	if (exact) return [exact.en];
	const parts = cleaned.split(/\s*[,;|]\s*|\s+\+\s+/);
	const choices: string[] = [];
	for (let start = 0; start < parts.length;) {
		let matched = false;
		for (let end = parts.length; end > start; end--) {
			const entry = indices[key]?.get(categoryKey(parts.slice(start, end).join(", ")));
			if (entry) {
				choices.push(entry.en);
				start = end;
				matched = true;
				break;
			}
		}
		if (!matched) choices.push(parts[start++] ?? "");
	}
	return [...new Set(choices.filter(Boolean))].sort((a, b) => a.localeCompare(b));
};
export const normalizeCategory = (key: string, value: string) => {
	const cleaned = value.normalize("NFC").trim().replace(/\s+/g, " ");
	const exact = indices[key]?.get(categoryKey(cleaned));
	if (exact) return exact.en;
	if (combinationFields.has(key)) {
		const choices = categorySelections(key, cleaned);
		// Preserve an ambiguous/free-form combination verbatim until reviewed.
		if (choices.length && choices.every(choice => indices[key]?.has(categoryKey(choice))))
			return choices.join(" + ");
	}
	return cleaned;
};
export const programDiscipline = (value: string) =>
	!value.trim() ? "" : (indices.areaOfStudy?.get(categoryKey(value))?.discipline ?? "Unclassified discipline");
const disciplineLabels: Record<string, string> = {
	"Computing and information technology": "Informatique et technologies de l’information",
	"Computing and mathematics (joint)": "Informatique et mathématiques (programme conjoint)",
	"Computing and engineering (joint)": "Informatique et génie (programme conjoint)",
	Engineering: "Génie",
	"Mathematics and data science": "Mathématiques et science des données",
	"Natural and health sciences": "Sciences naturelles et de la santé",
	"Social sciences and humanities": "Sciences sociales et humaines",
	Law: "Droit",
	"Business and management": "Affaires et gestion",
	"Arts and design": "Arts et design",
	"Not applicable": "Sans objet",
	"Unclassified discipline": "Domaine non classé",
};
export const displayCategory = (key: string, value: string, locale = "en") => {
	const normalized = normalizeCategory(key, value);
	if (locale.startsWith("fr"))
		return key === "discipline"
			? (disciplineLabels[value] ?? value)
			: combinationFields.has(key)
				? normalized
						.split(" + ")
						.map(choice => indices[key]?.get(categoryKey(choice))?.fr ?? choice)
						.join(" + ")
				: (indices[key]?.get(categoryKey(normalized))?.fr ?? normalized);
	return normalized;
};
export type NormalizationField = {
	key: string;
	answered: number;
	recognized: number;
	unmapped: number;
	sourceCategories: number;
	normalizedCategories: number;
	mergedVariants: number;
};
export const normalizationSummary = (key: string, values: string[]): NormalizationField => {
	const provided = values.map(value => value.trim()).filter(Boolean);
	const sourceCategories = new Set(provided).size;
	const normalizedCategories = new Set(provided.map(value => normalizeCategory(key, value).toLowerCase())).size;
	const recognized = provided.filter(
		value =>
			indices[key]?.has(categoryKey(value)) ||
			(combinationFields.has(key) &&
				categorySelections(key, value).every(choice => indices[key]?.has(categoryKey(choice)))),
	).length;
	return {
		key,
		answered: provided.length,
		recognized,
		unmapped: provided.length - recognized,
		sourceCategories,
		normalizedCategories,
		mergedVariants: sourceCategories - normalizedCategories,
	};
};
