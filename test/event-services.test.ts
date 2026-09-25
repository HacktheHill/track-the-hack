import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
	LatteDrink,
	HardwareInventoryMode,
	LatteFlavour,
	LatteIngredient,
	LatteMilkBase,
	LatteSweetener,
	LatteTemperature,
} from "@prisma/client";
import { normalizeHardwareName, validateHardwareImport } from "@/server/services/hardware-import";
import { evaluateMlhHardwareImport, mlhHardwareItems } from "@/server/services/mlh-hardware";
import {
	hardwareReturnError,
	isHardwareAvailable,
	outstandingHardwareQuantity,
} from "@/server/services/hardware-inventory";
import { evaluateHardwareReconciliation, hardwareReconciliationKeys } from "@/server/services/hardware-reconciliation";
import { allergensForConfiguration, availableRecipe, configurationError } from "@/server/services/latte-lab";

void test("hardware import accepts cleaned units and reports exact totals", () => {
	const result = validateHardwareImport([
		{
			importKey: "arduino-uno",
			category: "Microcontrollers",
			name: "Arduino Uno",
			quantity: "4",
			inventoryMode: "COUNTED",
			consumptionAllowed: "false",
			description: "Board",
		},
	]);
	assert.deepEqual(result.errors, []);
	assert.equal(result.totalKnownQuantity, 4);
	assert.equal(result.countedItemCount, 1);
	assert.equal(result.uncountedItemCount, 0);
	assert.equal(result.rows[0]?.normalizedName, "arduino uno");
});

void test("hardware import accepts uncounted consumption-enabled items without invented quantities", () => {
	const result = validateHardwareImport([
		{
			importKey: "resistors",
			category: "Miscellaneous",
			name: "Resistors",
			quantity: "",
			inventoryMode: "UNCOUNTED",
			consumptionAllowed: "true",
		},
	]);
	assert.deepEqual(result.errors, []);
	assert.equal(result.rows[0]?.inventoryMode, HardwareInventoryMode.UNCOUNTED);
	assert.equal(result.rows[0]?.quantity, null);
	assert.equal(result.uncountedItemCount, 1);
	assert.equal(result.consumptionEnabledItemCount, 1);
});

void test("hardware import rejects duplicates, invalid quantities, categories, and unresolved bulk units", () => {
	const result = validateHardwareImport([
		{
			importKey: "wire",
			category: "Inputs",
			name: "Wire box",
			quantity: "1",
			inventoryMode: "UNCOUNTED",
			consumptionAllowed: "yes",
		},
		{
			importKey: "wire",
			category: "Unknown",
			name: " WIRE BOX ",
			quantity: "1.5",
			inventoryMode: "COUNTED",
			consumptionAllowed: "false",
		},
	]);
	assert.match(result.errors.join("\n"), /bulk/);
	assert.match(result.errors.join("\n"), /duplicate import key/);
	assert.match(result.errors.join("\n"), /unknown category/);
	assert.match(result.errors.join("\n"), /non-negative integer/);
	assert.match(result.errors.join("\n"), /uncounted quantity must be blank/);
	assert.match(result.errors.join("\n"), /consumptionAllowed/);
	assert.equal(normalizeHardwareName("  USB   Cable "), "usb cable");
});

void test("hardware availability distinguishes exact and uncounted stock", () => {
	assert.equal(
		isHardwareAvailable({
			inventoryMode: HardwareInventoryMode.COUNTED,
			availableQuantity: 5,
			availableForCheckout: false,
		}),
		false,
	);
	assert.equal(
		isHardwareAvailable({
			inventoryMode: HardwareInventoryMode.COUNTED,
			availableQuantity: 0,
			availableForCheckout: true,
		}),
		false,
	);
	assert.equal(
		isHardwareAvailable({
			inventoryMode: HardwareInventoryMode.UNCOUNTED,
			availableQuantity: null,
			availableForCheckout: true,
		}),
		true,
	);
});

void test("MLH hardware supplement has stable unique catalogue records", () => {
	assert.equal(mlhHardwareItems.length, 43);
	assert.equal(new Set(mlhHardwareItems.map(item => item.importKey)).size, mlhHardwareItems.length);
	assert.equal(
		new Set(mlhHardwareItems.map(item => `${item.category}:${normalizeHardwareName(item.name)}`)).size,
		mlhHardwareItems.length,
	);
	assert.equal(mlhHardwareItems.filter(item => item.quantity === null).length, 2);
	assert.equal(mlhHardwareItems.filter(item => !item.availableForCheckout).length, 6);
	assert.equal(mlhHardwareItems.filter(item => item.availableForCheckout && item.quantity !== null).length, 35);
	assert.equal(
		mlhHardwareItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
		355,
	);
	assert.equal(
		mlhHardwareItems.every(item => existsSync(`public${item.imageURL}`)),
		true,
	);
	assert.deepEqual(evaluateMlhHardwareImport([]).errors, []);
});

void test("hardware outcomes include consumed and enforce per-item eligibility", () => {
	const line = {
		borrowedQuantity: 12,
		goodQuantity: 3,
		damagedQuantity: 1,
		missingQuantity: 0,
		consumedQuantity: 6,
	};
	assert.equal(outstandingHardwareQuantity(line), 2);
	assert.equal(
		hardwareReturnError({ ...line, consumptionAllowed: true }, { good: 1, damaged: 0, missing: 0, consumed: 1 }),
		null,
	);
	assert.match(
		hardwareReturnError({ ...line, consumptionAllowed: false }, { good: 0, damaged: 0, missing: 0, consumed: 1 }) ??
			"",
		/Consumed is not allowed/,
	);
	assert.match(
		hardwareReturnError({ ...line, consumptionAllowed: true }, { good: 3, damaged: 0, missing: 0, consumed: 0 }) ??
			"",
		/exceeds outstanding/,
	);
});

void test("hardware reconciliation refuses loan history before reclassifying bulk records", () => {
	const items = hardwareReconciliationKeys.map((importKey, index) => ({
		id: `item-${index}`,
		importKey,
		name: `Item ${index}`,
		inventoryMode: HardwareInventoryMode.COUNTED,
		totalQuantity: index + 1,
		availableQuantity: index + 1,
		availableForCheckout: true,
		damagedQuantity: 0,
		missingQuantity: 0,
		consumedQuantity: 0,
		consumptionAllowed: false,
		description: index < 6 ? "Checkout unit: one bag." : null,
		_count: { loanLines: index === 0 ? 1 : 0 },
	}));
	const result = evaluateHardwareReconciliation(items);
	assert.match(result.errors.join("\n"), /small-black-buttons has 1 loan line/);
	assert.equal(result.alreadyApplied, false);
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

void test("Hot Chocolate uses its dedicated mix without requiring mocha chocolate", () => {
	const available = new Set([LatteIngredient.HOT_CHOCOLATE_MIX]);
	assert.equal(availableRecipe(LatteDrink.HOT_CHOCOLATE, available).enabled, true);
	assert.equal(
		configurationError(
			{
				drink: LatteDrink.HOT_CHOCOLATE,
				temperature: LatteTemperature.HOT,
				milkBase: LatteMilkBase.WATER,
				flavour: LatteFlavour.CHOCOLATE,
				sweetener: LatteSweetener.NONE,
			},
			available,
		),
		null,
	);
});
