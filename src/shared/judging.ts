export const MAIN_CATEGORY_CODES = ["GENERAL", "CIVIC"] as const;
export const MINI_CATEGORY_CODES = [
	"ELEVENLABS",
	"FOSS",
	"UI_UX",
	"HARDWARE",
	"MATHEMATECH",
	"GEMINI",
	"SOLANA",
	"TIGER_DATA",
	"PRESAGE",
	"VULTR",
	"AUTH0",
	"GODADDY",
] as const;

export const MLH_CATEGORY_CODES = [
	"ELEVENLABS",
	"GEMINI",
	"SOLANA",
	"TIGER_DATA",
	"PRESAGE",
	"VULTR",
	"AUTH0",
	"GODADDY",
] as const satisfies readonly (typeof MINI_CATEGORY_CODES)[number][];

export type MainCategoryCode = (typeof MAIN_CATEGORY_CODES)[number];
export type MiniCategoryCode = (typeof MINI_CATEGORY_CODES)[number];
export type JudgingCategoryCode = MainCategoryCode | MiniCategoryCode;
export type JudgingMainTrackCode = MainCategoryCode | "CGI";

export const isMiniAssessmentEligibleForRanking = ({
	eligibility,
	score,
	resolution,
}: {
	eligibility: "ELIGIBLE" | "UNSURE" | "INELIGIBLE" | null;
	score: number | null;
	resolution?: "ELIGIBLE" | "UNSURE" | "INELIGIBLE" | null;
}) => score !== null && resolution !== "INELIGIBLE" && (eligibility === "ELIGIBLE" || resolution === "ELIGIBLE");

export const ALL_JUDGING_CATEGORY_CODES = [...MAIN_CATEGORY_CODES, ...MINI_CATEGORY_CODES] as const;

export const canonicalProjectCategoryCodes = (
	mainTrack: JudgingMainTrackCode,
	categories: readonly MiniCategoryCode[],
) => [mainTrack, ...categories];

type LocalizedText = { en: string; fr: string };

export const JUDGING_CATEGORY_CATALOG: Record<JudgingCategoryCode, LocalizedText & { guidance: LocalizedText }> = {
	GENERAL: {
		en: "General Challenge — Best Overall",
		fr: "Défi général — Meilleur projet global",
		guidance: {
			en: "Use the complete 45-point Hack the Hill rubric.",
			fr: "Utilisez la grille complète de 45 points de Hack the Hill.",
		},
	},
	CIVIC: {
		en: "Civic Technology",
		fr: "Technologie civique",
		guidance: {
			en: "Use the complete 45-point rubric after confirming the civic connection.",
			fr: "Utilisez la grille complète de 45 points après avoir confirmé le lien civique.",
		},
	},
	ELEVENLABS: {
		en: "Best Project Built with ElevenLabs / Best Use of ElevenLabs",
		fr: "Meilleur projet créé avec ElevenLabs / Meilleure utilisation d’ElevenLabs",
		guidance: {
			en: "Assess meaningful, functional use of ElevenLabs.",
			fr: "Évaluez l’utilisation significative et fonctionnelle d’ElevenLabs.",
		},
	},
	FOSS: {
		en: "Best FOSS Project",
		fr: "Meilleur projet libre",
		guidance: {
			en: "Confirm the core implementation uses only open-source technologies, then assess its quality and execution.",
			fr: "Confirmez que la mise en œuvre principale utilise uniquement des technologies libres, puis évaluez sa qualité et son exécution.",
		},
	},
	UI_UX: {
		en: "Best UI/UX",
		fr: "Meilleure interface et expérience utilisateur",
		guidance: {
			en: "Assess usability, interaction design, coherence, clarity, and basic accessibility.",
			fr: "Évaluez la convivialité, les interactions, la cohérence, la clarté et l’accessibilité de base.",
		},
	},
	HARDWARE: {
		en: "Best Hardware Hack",
		fr: "Meilleur projet matériel",
		guidance: {
			en: "Confirm hardware is central, then assess integration, execution, creativity, and whether it works.",
			fr: "Confirmez que le matériel est essentiel, puis évaluez l’intégration, l’exécution, la créativité et le fonctionnement.",
		},
	},
	MATHEMATECH: {
		en: "MathemaTech — Education for Everyone",
		fr: "MathemaTech — L’éducation pour tous",
		guidance: {
			en: "Assess educational value, accessibility and reach, creativity, and implementation quality.",
			fr: "Évaluez la valeur éducative, l’accessibilité, la portée, la créativité et la qualité de la mise en œuvre.",
		},
	},
	GEMINI: {
		en: "Best Use of Gemini API",
		fr: "Meilleure utilisation de l’API Gemini",
		guidance: {
			en: "Assess meaningful Gemini-powered AI capabilities.",
			fr: "Évaluez les capacités d’IA significatives propulsées par Gemini.",
		},
	},
	SOLANA: {
		en: "Best Use of Solana",
		fr: "Meilleure utilisation de Solana",
		guidance: {
			en: "Assess meaningful and effective use of Solana.",
			fr: "Évaluez l’utilisation significative et efficace de Solana.",
		},
	},
	TIGER_DATA: {
		en: "Best Use of Tiger Data",
		fr: "Meilleure utilisation de Tiger Data",
		guidance: {
			en: "Assess innovative and effective use of Tiger Data.",
			fr: "Évaluez l’utilisation innovante et efficace de Tiger Data.",
		},
	},
	PRESAGE: {
		en: "Best Use of Presage",
		fr: "Meilleure utilisation de Presage",
		guidance: {
			en: "Assess meaningful use of a Presage SDK.",
			fr: "Évaluez l’utilisation significative d’un SDK Presage.",
		},
	},
	VULTR: {
		en: "Best Use of Vultr",
		fr: "Meilleure utilisation de Vultr",
		guidance: {
			en: "Assess meaningful use of Vultr infrastructure or compute.",
			fr: "Évaluez l’utilisation significative de l’infrastructure ou du calcul Vultr.",
		},
	},
	AUTH0: {
		en: "Best Use of Auth0",
		fr: "Meilleure utilisation d’Auth0",
		guidance: {
			en: "Assess meaningful Auth0 authentication or security capabilities.",
			fr: "Évaluez les capacités significatives d’authentification ou de sécurité Auth0.",
		},
	},
	GODADDY: {
		en: "Best Domain Name from GoDaddy Registry",
		fr: "Meilleur nom de domaine du registre GoDaddy",
		guidance: {
			en: "Assess effective use of a GoDaddy Registry domain.",
			fr: "Évaluez l’utilisation efficace d’un domaine du registre GoDaddy.",
		},
	},
};

export const MAIN_RUBRIC = [
	{
		key: "technicalLevel",
		maximum: 15,
		label: { en: "Technical Execution", fr: "Exécution technique" },
		guidance: {
			en: {
				low: "Core functionality is missing, unreliable, or not understood.",
				competent: "Core functionality works and the team explains sound technical choices.",
				standout:
					"A reliable implementation tackles meaningful technical difficulty with excellent understanding.",
			},
			fr: {
				low: "La fonction principale est absente, peu fiable ou mal comprise.",
				competent: "La fonction principale marche et l’équipe explique des choix techniques solides.",
				standout:
					"Une mise en œuvre fiable relève un défi technique important avec une excellente compréhension.",
			},
		},
	},
	{
		key: "ideaLevel",
		maximum: 10,
		label: { en: "Idea & Impact", fr: "Idée et impact" },
		guidance: {
			en: {
				low: "The idea or intended value is unclear and the build does not deliver it.",
				competent: "The idea is clear and the implementation provides credible value or interest.",
				standout:
					"A compelling or creative idea is delivered in a way that creates exceptional value or impact.",
			},
			fr: {
				low: "L’idée ou sa valeur est peu claire et le projet ne la concrétise pas.",
				competent: "L’idée est claire et la mise en œuvre apporte une valeur ou un intérêt crédible.",
				standout: "Une idée captivante ou créative est réalisée avec une valeur ou un impact exceptionnel.",
			},
		},
	},
	{
		key: "designLevel",
		maximum: 10,
		label: { en: "Design & Usability", fr: "Conception et convivialité" },
		guidance: {
			en: {
				low: "The core experience is difficult to understand or use.",
				competent: "The core experience is understandable, usable, and supports its purpose.",
				standout: "The experience is exceptionally clear, coherent, inclusive, and well suited to its purpose.",
			},
			fr: {
				low: "L’expérience principale est difficile à comprendre ou à utiliser.",
				competent: "L’expérience principale est claire, utilisable et adaptée à son objectif.",
				standout: "L’expérience est exceptionnellement claire, cohérente, inclusive et adaptée à son objectif.",
			},
		},
	},
	{
		key: "learningLevel",
		maximum: 5,
		label: { en: "Learning & Technical Decisions", fr: "Apprentissage et décisions techniques" },
		guidance: {
			en: {
				low: "Challenges, trade-offs, and lessons are missing or superficial.",
				competent: "The team explains real challenges, trade-offs, and lessons from the weekend.",
				standout:
					"The team shows exceptional problem-solving and insight into difficult decisions and lessons.",
			},
			fr: {
				low: "Les défis, compromis et apprentissages sont absents ou superficiels.",
				competent: "L’équipe explique de vrais défis, compromis et apprentissages de la fin de semaine.",
				standout:
					"L’équipe démontre une résolution de problèmes et une compréhension exceptionnelles de décisions difficiles.",
			},
		},
	},
	{
		key: "presentationLevel",
		maximum: 5,
		label: { en: "Presentation", fr: "Présentation" },
		guidance: {
			en: {
				low: "The explanation or demo is unclear, incomplete, or does not support key claims.",
				competent:
					"The presentation is clear, uses the time well, demonstrates the project, and answers questions.",
				standout:
					"A polished, memorable presentation makes the project's strengths and evidence exceptionally clear.",
			},
			fr: {
				low: "L’explication ou la démo est peu claire, incomplète ou n’appuie pas les affirmations importantes.",
				competent:
					"La présentation est claire, utilise bien le temps, démontre le projet et répond aux questions.",
				standout:
					"Une présentation mémorable rend les forces du projet et leurs preuves exceptionnellement claires.",
			},
		},
	},
] as const;

export type MainRubricKey = (typeof MAIN_RUBRIC)[number]["key"];

export const SCORE_LEVEL_LABELS: Record<number, LocalizedText> = {
	0: { en: "Not demonstrated", fr: "Non démontré" },
	1: { en: "Substantially missing", fr: "Largement absent" },
	2: { en: "Weak", fr: "Faible" },
	3: { en: "Competent", fr: "Compétent" },
	4: { en: "Strong", fr: "Fort" },
	5: { en: "Standout", fr: "Exceptionnel" },
};

export const pointsForLevel = (level: number, maximum: number) => {
	if (!Number.isInteger(level) || level < 0 || level > 5)
		throw new Error("Judging level must be an integer from 0 to 5");
	return Math.round((level / 5) * maximum);
};

export const mainScoreTotal = (levels: Partial<Record<MainRubricKey, number>>) =>
	MAIN_RUBRIC.reduce((total, criterion) => {
		const level = levels[criterion.key];
		return total + (level === undefined || level === null ? 0 : pointsForLevel(level, criterion.maximum));
	}, 0);

export const isMainCategoryCode = (value: string): value is MainCategoryCode =>
	MAIN_CATEGORY_CODES.some(code => code === value);

export const isMiniCategoryCode = (value: string): value is MiniCategoryCode =>
	MINI_CATEGORY_CODES.some(code => code === value);

export const isJudgingCategoryCode = (value: string): value is JudgingCategoryCode =>
	ALL_JUDGING_CATEGORY_CODES.some(code => code === value);

const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-CA");

const categoryAliasEntries: Array<[string, JudgingCategoryCode | "CGI"]> = [
	["General Challenge — Best Overall", "GENERAL"],
	["General Challenge - Best Overall", "GENERAL"],
	["Civic Technology", "CIVIC"],
	["CGI", "CGI"],
	["CGI Challenge — The Northwind Brief", "CGI"],
	["CGI — The Northwind Brief", "CGI"],
	...ALL_JUDGING_CATEGORY_CODES.map((code): [string, JudgingCategoryCode] => [
		JUDGING_CATEGORY_CATALOG[code].en,
		code,
	]),
];
const categoryAliases = new Map<string, JudgingCategoryCode | "CGI">(
	categoryAliasEntries.map(([label, code]) => [normalizeLabel(label), code]),
);

const categoryCodesWithCgi: Array<JudgingCategoryCode | "CGI"> = [...ALL_JUDGING_CATEGORY_CODES, "CGI"];
for (const code of categoryCodesWithCgi) categoryAliases.set(normalizeLabel(code), code);

export const parseCategoryLabel = (value: string) => categoryAliases.get(normalizeLabel(value));

export const rubricSnapshot = (locale: "en" | "fr" = "en") => ({
	version: 1,
	levels: Object.entries(SCORE_LEVEL_LABELS).map(([level, labels]) => ({
		level: Number(level),
		label: labels[locale],
	})),
	main: MAIN_RUBRIC.map(criterion => ({
		key: criterion.key,
		maximum: criterion.maximum,
		label: criterion.label[locale],
		guidance: criterion.guidance[locale],
	})),
	categories: ALL_JUDGING_CATEGORY_CODES.map(code => ({
		code,
		label: JUDGING_CATEGORY_CATALOG[code][locale],
		guidance: JUDGING_CATEGORY_CATALOG[code].guidance[locale],
	})),
});
