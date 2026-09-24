import {
	LatteDrink,
	LatteFlavour,
	LatteIngredient,
	LatteMilkBase,
	LatteOrderStatus,
	LatteSweetener,
	LatteTemperature,
} from "@prisma/client";

export type LatteConfiguration = {
	drink: LatteDrink;
	temperature: LatteTemperature;
	milkBase: LatteMilkBase;
	flavour: LatteFlavour;
	sweetener: LatteSweetener;
};

type Recipe = {
	temperatures: LatteTemperature[];
	milkBases: LatteMilkBase[];
	flavours: LatteFlavour[];
	sweeteners: LatteSweetener[];
	required: LatteIngredient[];
};

export const ACTIVE_LATTE_STATUSES = [LatteOrderStatus.QUEUED, LatteOrderStatus.PREPARING, LatteOrderStatus.READY];

export const LATTE_RECIPES: Record<LatteDrink, Recipe> = {
	COFFEE: {
		temperatures: [LatteTemperature.HOT, LatteTemperature.ICED],
		milkBases: [LatteMilkBase.NONE, LatteMilkBase.DAIRY, LatteMilkBase.OAT, LatteMilkBase.ALMOND],
		flavours: [
			LatteFlavour.NONE,
			LatteFlavour.FRENCH_VANILLA,
			LatteFlavour.CARAMEL,
			LatteFlavour.BROWN_SUGAR_CINNAMON,
		],
		sweeteners: [LatteSweetener.NONE, LatteSweetener.SUGAR, LatteSweetener.SUBSTITUTE],
		required: [LatteIngredient.COFFEE],
	},
	DECAF_COFFEE: {
		temperatures: [LatteTemperature.HOT],
		milkBases: [LatteMilkBase.NONE, LatteMilkBase.DAIRY, LatteMilkBase.OAT, LatteMilkBase.ALMOND],
		flavours: [LatteFlavour.NONE],
		sweeteners: [LatteSweetener.NONE, LatteSweetener.SUGAR, LatteSweetener.SUBSTITUTE],
		required: [LatteIngredient.DECAF],
	},
	LATTE: {
		temperatures: [LatteTemperature.HOT, LatteTemperature.ICED],
		milkBases: [LatteMilkBase.DAIRY, LatteMilkBase.OAT, LatteMilkBase.ALMOND],
		flavours: [
			LatteFlavour.NONE,
			LatteFlavour.FRENCH_VANILLA,
			LatteFlavour.CARAMEL,
			LatteFlavour.BROWN_SUGAR_CINNAMON,
		],
		sweeteners: [LatteSweetener.NONE],
		required: [LatteIngredient.COFFEE],
	},
	MOCHA: {
		temperatures: [LatteTemperature.HOT, LatteTemperature.ICED],
		milkBases: [LatteMilkBase.DAIRY, LatteMilkBase.OAT, LatteMilkBase.ALMOND],
		flavours: [LatteFlavour.CHOCOLATE],
		sweeteners: [LatteSweetener.NONE],
		required: [LatteIngredient.COFFEE, LatteIngredient.CHOCOLATE],
	},
	CHAI_LATTE: {
		temperatures: [LatteTemperature.HOT, LatteTemperature.ICED],
		milkBases: [LatteMilkBase.DAIRY, LatteMilkBase.OAT, LatteMilkBase.ALMOND],
		flavours: [LatteFlavour.NONE],
		sweeteners: [LatteSweetener.NONE],
		required: [LatteIngredient.CHAI_CONCENTRATE],
	},
	LONDON_FOG: {
		temperatures: [LatteTemperature.HOT],
		milkBases: [LatteMilkBase.DAIRY, LatteMilkBase.OAT, LatteMilkBase.ALMOND],
		flavours: [LatteFlavour.FRENCH_VANILLA],
		sweeteners: [LatteSweetener.NONE],
		required: [LatteIngredient.EARL_GREY, LatteIngredient.FRENCH_VANILLA],
	},
	TEA: {
		temperatures: [LatteTemperature.HOT],
		milkBases: [LatteMilkBase.NONE, LatteMilkBase.DAIRY, LatteMilkBase.OAT, LatteMilkBase.ALMOND],
		flavours: [LatteFlavour.NONE],
		sweeteners: [LatteSweetener.NONE, LatteSweetener.SUGAR, LatteSweetener.SUBSTITUTE],
		required: [LatteIngredient.TEA],
	},
	HOT_CHOCOLATE: {
		temperatures: [LatteTemperature.HOT],
		milkBases: [LatteMilkBase.WATER, LatteMilkBase.DAIRY, LatteMilkBase.OAT, LatteMilkBase.ALMOND],
		flavours: [LatteFlavour.CHOCOLATE],
		sweeteners: [LatteSweetener.NONE],
		required: [LatteIngredient.HOT_CHOCOLATE_MIX],
	},
};

const milkIngredient: Partial<Record<LatteMilkBase, LatteIngredient>> = {
	DAIRY: LatteIngredient.DAIRY_MILK,
	OAT: LatteIngredient.OAT_MILK,
	ALMOND: LatteIngredient.ALMOND_MILK,
};
const flavourIngredient: Partial<Record<LatteFlavour, LatteIngredient>> = {
	FRENCH_VANILLA: LatteIngredient.FRENCH_VANILLA,
	CARAMEL: LatteIngredient.CARAMEL,
	BROWN_SUGAR_CINNAMON: LatteIngredient.BROWN_SUGAR_CINNAMON,
	CHOCOLATE: LatteIngredient.CHOCOLATE,
};
const sweetenerIngredient: Partial<Record<LatteSweetener, LatteIngredient>> = {
	SUGAR: LatteIngredient.SUGAR,
	SUBSTITUTE: LatteIngredient.SUGAR_SUBSTITUTE,
};

export const ingredientsForConfiguration = (configuration: LatteConfiguration) => {
	const ingredients = [...LATTE_RECIPES[configuration.drink].required];
	if (configuration.temperature === LatteTemperature.ICED) ingredients.push(LatteIngredient.ICE);
	const milk = milkIngredient[configuration.milkBase];
	if (milk) ingredients.push(milk);
	const flavour = flavourIngredient[configuration.flavour];
	if (flavour) ingredients.push(flavour);
	const sweetener = sweetenerIngredient[configuration.sweetener];
	if (sweetener) ingredients.push(sweetener);
	return [...new Set(ingredients)];
};

export const configurationError = (configuration: LatteConfiguration, available: Set<LatteIngredient>) => {
	const recipe = LATTE_RECIPES[configuration.drink];
	if (
		!recipe.temperatures.includes(configuration.temperature) ||
		!recipe.milkBases.includes(configuration.milkBase) ||
		!recipe.flavours.includes(configuration.flavour) ||
		!recipe.sweeteners.includes(configuration.sweetener)
	)
		return "INVALID_CONFIGURATION" as const;
	// Coffee syrups are only offered for iced coffee.
	if (
		configuration.drink === LatteDrink.COFFEE &&
		configuration.temperature !== LatteTemperature.ICED &&
		configuration.flavour !== LatteFlavour.NONE
	)
		return "INVALID_CONFIGURATION" as const;
	return ingredientsForConfiguration(configuration).every(ingredient => available.has(ingredient))
		? null
		: ("INGREDIENT_UNAVAILABLE" as const);
};

export const allergensForConfiguration = (configuration: LatteConfiguration) => [
	...(configuration.milkBase === LatteMilkBase.DAIRY ? ["DAIRY" as const] : []),
	...(configuration.milkBase === LatteMilkBase.ALMOND ? ["ALMOND" as const] : []),
];

export const availableRecipe = (drink: LatteDrink, available: Set<LatteIngredient>) => {
	const recipe = LATTE_RECIPES[drink];
	const temperatures = recipe.temperatures.filter(
		value => value !== LatteTemperature.ICED || available.has(LatteIngredient.ICE),
	);
	const milkBases = recipe.milkBases.filter(value => {
		const ingredient = milkIngredient[value];
		return !ingredient || available.has(ingredient);
	});
	const flavours = recipe.flavours.filter(value => {
		const ingredient = flavourIngredient[value];
		return !ingredient || available.has(ingredient);
	});
	const sweeteners = recipe.sweeteners.filter(value => {
		const ingredient = sweetenerIngredient[value];
		return !ingredient || available.has(ingredient);
	});
	const requiredAvailable = recipe.required.every(value => available.has(value));
	return {
		drink,
		enabled:
			requiredAvailable &&
			temperatures.length > 0 &&
			milkBases.length > 0 &&
			flavours.length > 0 &&
			sweeteners.length > 0,
		temperatures,
		milkBases,
		flavours,
		sweeteners,
	};
};
