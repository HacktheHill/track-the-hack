import assert from "node:assert/strict";
import test from "node:test";
import {
	LatteDrink,
	LatteFlavour,
	LatteIngredient,
	LatteMilkBase,
	LatteSweetener,
	LatteTemperature,
} from "@prisma/client";
import { normalizeHardwareName, validateHardwareImport } from "@/server/services/hardware-import";
import { allergensForConfiguration, availableRecipe, configurationError } from "@/server/services/latte-lab";

void test("hardware import accepts cleaned units and reports exact totals", () => {
	const result = validateHardwareImport([
		{
			importKey: "arduino-uno",
			category: "Microcontrollers",
			name: "Arduino Uno",
			quantity: "4",
			description: "Board",
		},
	]);
	assert.deepEqual(result.errors, []);
	assert.equal(result.totalQuantity, 4);
	assert.equal(result.rows[0]?.normalizedName, "arduino uno");
});

void test("hardware import rejects duplicates, invalid quantities, categories, and unresolved bulk units", () => {
	const result = validateHardwareImport([
		{ importKey: "wire", category: "Inputs", name: "Wire box", quantity: "1" },
		{ importKey: "wire", category: "Unknown", name: " WIRE BOX ", quantity: "1.5" },
	]);
	assert.match(result.errors.join("\n"), /bulk/);
	assert.match(result.errors.join("\n"), /duplicate import key/);
	assert.match(result.errors.join("\n"), /unknown category/);
	assert.match(result.errors.join("\n"), /non-negative integer/);
	assert.equal(normalizeHardwareName("  USB   Cable "), "usb cable");
});

void test("Latte recipes reject impossible combinations and unavailable ingredients", () => {
	const all = new Set(Object.values(LatteIngredient));
	assert.equal(
		configurationError(
			{
				drink: LatteDrink.LATTE,
				temperature: LatteTemperature.HOT,
				milkBase: LatteMilkBase.NONE,
				flavour: LatteFlavour.NONE,
				sweetener: LatteSweetener.NONE,
			},
			all,
		),
		"INVALID_CONFIGURATION",
	);
	all.delete(LatteIngredient.ICE);
	assert.equal(
		configurationError(
			{
				drink: LatteDrink.CHAI_LATTE,
				temperature: LatteTemperature.ICED,
				milkBase: LatteMilkBase.OAT,
				flavour: LatteFlavour.NONE,
				sweetener: LatteSweetener.NONE,
			},
			all,
		),
		"INGREDIENT_UNAVAILABLE",
	);
});

void test("Latte availability and allergen badges derive from ingredients", () => {
	const onlyCoffee = new Set([LatteIngredient.COFFEE]);
	const coffee = availableRecipe(LatteDrink.COFFEE, onlyCoffee);
	assert.equal(coffee.enabled, true);
	assert.deepEqual(coffee.temperatures, [LatteTemperature.HOT]);
	assert.deepEqual(
		allergensForConfiguration({
			drink: LatteDrink.LATTE,
			temperature: LatteTemperature.HOT,
			milkBase: LatteMilkBase.ALMOND,
			flavour: LatteFlavour.NONE,
			sweetener: LatteSweetener.NONE,
		}),
		["ALMOND"],
	);
});
