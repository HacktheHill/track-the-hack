import { HardwareCategory, HardwareInventoryMode, HardwareOwner, Prisma, type PrismaClient } from "@prisma/client";

const normalizeHardwareName = (value: string) => value.trim().toLocaleLowerCase("en-CA").replace(/\s+/g, " ");

export const mlhHardwareSource = "https://guide.mlh.com/organizer-resources/hardware-lab-contents";

type MlhHardwareItem = {
	importKey: string;
	category: HardwareCategory;
	name: string;
	inventoryMode: HardwareInventoryMode;
	quantity: number | null;
	consumptionAllowed: boolean;
	availableForCheckout: boolean;
	description: string;
	imageURL: string;
};

const image = (key: string) => `/assets/hardware/mlh/${key}.webp`;
const counted = (importKey: string, category: HardwareCategory, name: string, quantity: number): MlhHardwareItem => ({
	importKey,
	category,
	name,
	inventoryMode: HardwareInventoryMode.COUNTED,
	quantity,
	consumptionAllowed: false,
	availableForCheckout: true,
	description: "MLH Hardware Lab item; published kit quantities may vary.",
	imageURL: image(importKey),
});
const uncounted = (importKey: string, name: string): MlhHardwareItem => ({
	importKey,
	category: HardwareCategory.MISCELLANEOUS,
	name,
	inventoryMode: HardwareInventoryMode.UNCOUNTED,
	quantity: null,
	consumptionAllowed: true,
	availableForCheckout: true,
	description: "MLH Hardware Lab assortment; available quantity varies by kit.",
	imageURL: image(importKey),
});
const deskTool = (importKey: string, name: string): MlhHardwareItem => ({
	importKey,
	category: HardwareCategory.MISCELLANEOUS,
	name,
	inventoryMode: HardwareInventoryMode.COUNTED,
	quantity: 1,
	consumptionAllowed: false,
	availableForCheckout: false,
	description: "MLH shared tool. Keep at the Hardware Desk for supervised use.",
	imageURL: image(importKey),
});

export const mlhHardwareItems = [
	counted("mlh-raspberry-pi-4b-kits", HardwareCategory.MICROCONTROLLERS, "Raspberry Pi 4B Kits", 9),
	counted("mlh-arduinos-and-base-shields", HardwareCategory.MICROCONTROLLERS, "Arduinos and Base Shields", 12),
	counted("mlh-logitech-webcams", HardwareCategory.INPUTS, "Logitech Webcams", 8),
	counted("mlh-google-nest-mini", HardwareCategory.OUTPUTS, "Google Nest Mini", 4),
	counted("mlh-jbl-go-3-speaker", HardwareCategory.OUTPUTS, "JBL Go 3 Speaker", 2),
	counted("mlh-grove-buzzer", HardwareCategory.OUTPUTS, "Grove Buzzer", 10),
	counted("mlh-grove-touch-sensor", HardwareCategory.INPUTS, "Grove Touch Sensor", 10),
	counted("mlh-grove-led-socket-kit", HardwareCategory.OUTPUTS, "Grove LED Socket Kit", 20),
	counted(
		"mlh-grove-temperature-and-barometer-sensor",
		HardwareCategory.INPUTS,
		"Grove Temperature and Barometer Sensor",
		3,
	),
	counted("mlh-grove-button", HardwareCategory.INPUTS, "Grove Button", 12),
	counted("mlh-grove-rotary-angle-sensor", HardwareCategory.INPUTS, "Grove Rotary Angle Sensor", 5),
	counted("mlh-grove-sound-sensor", HardwareCategory.INPUTS, "Grove Sound Sensor", 10),
	counted(
		"mlh-grove-3-axis-digital-accelerometer",
		HardwareCategory.INPUTS,
		"Grove 3 Axis Digital Accelerometer",
		10,
	),
	counted("mlh-grove-light-sensor", HardwareCategory.INPUTS, "Grove Light Sensor", 10),
	counted("mlh-grove-i2c-color-sensor", HardwareCategory.INPUTS, "Grove I2C Color Sensor", 3),
	counted("mlh-grove-lcd-screen", HardwareCategory.OUTPUTS, "Grove LCD Screen", 4),
	counted("mlh-grove-stepper-motor", HardwareCategory.OUTPUTS, "Grove Stepper Motor", 3),
	counted("mlh-grove-ultrasonic-distance-sensor", HardwareCategory.INPUTS, "Grove Ultrasonic Distance Sensor", 3),
	counted("mlh-grove-cables", HardwareCategory.MISCELLANEOUS, "Grove Cables", 25),
	counted("mlh-grove-moisture-sensor", HardwareCategory.INPUTS, "Grove Moisture Sensor", 3),
	counted("mlh-grove-motor-servo-driver-board", HardwareCategory.OUTPUTS, "Grove Motor/Servo Driver Board", 5),
	counted("mlh-grove-air-quality-sensor", HardwareCategory.INPUTS, "Grove Air Quality Sensor", 3),
	counted("mlh-grove-micro-switch", HardwareCategory.INPUTS, "Grove Micro Switch", 12),
	counted("mlh-grove-thumb-joystick", HardwareCategory.INPUTS, "Grove Thumb Joystick", 6),
	counted("mlh-grove-uv-sensor", HardwareCategory.INPUTS, "Grove UV Sensor", 6),
	counted("mlh-grove-nfc-rfid-tag-board", HardwareCategory.INPUTS, "Grove NFC/RFID Tag Board", 1),
	counted("mlh-grove-infrared-reflective-sensor", HardwareCategory.INPUTS, "Grove Infrared Reflective Sensor", 6),
	counted(
		"mlh-grove-7-segment-alphanumeric-display",
		HardwareCategory.OUTPUTS,
		"Grove 7 Segment Alphanumeric Display",
		3,
	),
	counted("mlh-grove-stepper-and-driver", HardwareCategory.OUTPUTS, "Grove Stepper and Driver", 3),
	counted("mlh-grove-servo", HardwareCategory.OUTPUTS, "Grove Servo", 4),
	counted("mlh-brushless-dc-motors", HardwareCategory.OUTPUTS, "Brushless DC Motors", 4),
	counted("mlh-jumper-wires-f-f", HardwareCategory.MISCELLANEOUS, "Jumper Wires: F/F", 40),
	counted("mlh-jumper-wires-m-f", HardwareCategory.MISCELLANEOUS, "Jumper Wires: M/F", 40),
	counted("mlh-jumper-wires-m-m", HardwareCategory.MISCELLANEOUS, "Jumper Wires: M/M", 40),
	uncounted("mlh-ceramic-capacitors", "Ceramic Capacitors"),
	uncounted("mlh-resistor-kit", "Resistor Kit"),
	counted("mlh-breadboards", HardwareCategory.MISCELLANEOUS, "Breadboards", 10),
	deskTool("mlh-wire-stripper", "Wire Stripper"),
	deskTool("mlh-wire-cutter", "Wire Cutter"),
	deskTool("mlh-curved-tweezers", "Curved Tweezers"),
	deskTool("mlh-pointed-tweezers", "Pointed Tweezers"),
	deskTool("mlh-multimeter", "Multimeter"),
	deskTool("mlh-needle-nose-pliers", "Needle Nose Pliers"),
] as const satisfies readonly MlhHardwareItem[];

const existingSelection = {
	importKey: true,
	category: true,
	owner: true,
	name: true,
	normalizedName: true,
	inventoryMode: true,
	totalQuantity: true,
	availableQuantity: true,
	availableForCheckout: true,
	consumptionAllowed: true,
	description: true,
	imageURL: true,
	damagedQuantity: true,
	missingQuantity: true,
	consumedQuantity: true,
	_count: { select: { loanLines: true } },
} satisfies Prisma.HardwareItemSelect;

type ExistingItem = Prisma.HardwareItemGetPayload<{ select: typeof existingSelection }>;

const expectedFor = (item: MlhHardwareItem) => ({
	...item,
	owner: HardwareOwner.MLH,
	normalizedName: normalizeHardwareName(item.name),
	totalQuantity: item.quantity,
	availableQuantity: item.quantity,
	damagedQuantity: 0,
	missingQuantity: 0,
	consumedQuantity: 0,
});

export const evaluateMlhHardwareImport = (existing: ExistingItem[]) => {
	const errors: string[] = [];
	const byKey = new Map(existing.map(item => [item.importKey, item]));
	const byName = new Map(existing.map(item => [`${item.category}:${item.normalizedName}`, item]));
	let matching = 0;
	for (const source of mlhHardwareItems) {
		const expected = expectedFor(source);
		const current = byKey.get(source.importKey);
		const nameCollision = byName.get(`${source.category}:${expected.normalizedName}`);
		if (!current) {
			if (nameCollision)
				errors.push(`${source.importKey} conflicts with existing item ${nameCollision.importKey}`);
			continue;
		}
		const stableFieldsMatch =
			current.category === expected.category &&
			current.owner === expected.owner &&
			current.name === expected.name &&
			current.normalizedName === expected.normalizedName &&
			current.inventoryMode === expected.inventoryMode &&
			current.totalQuantity === expected.totalQuantity &&
			current.availableForCheckout === expected.availableForCheckout &&
			current.consumptionAllowed === expected.consumptionAllowed &&
			current.description === expected.description &&
			current.imageURL === expected.imageURL;
		if (stableFieldsMatch) matching += 1;
		else if (!stableFieldsMatch) errors.push(`${source.importKey} already exists with different catalogue data`);
	}
	if (matching > 0 && matching < mlhHardwareItems.length)
		errors.push(`Partial MLH import detected (${matching}/${mlhHardwareItems.length} exact matches)`);
	return {
		errors,
		alreadyApplied: matching === mlhHardwareItems.length,
		itemCount: mlhHardwareItems.length,
		countedItemCount: mlhHardwareItems.filter(item => item.inventoryMode === HardwareInventoryMode.COUNTED).length,
		totalKnownQuantity: mlhHardwareItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
		uncountedItemCount: mlhHardwareItems.filter(item => item.inventoryMode === HardwareInventoryMode.UNCOUNTED)
			.length,
		deskUseItemCount: mlhHardwareItems.filter(item => !item.availableForCheckout).length,
	};
};

const inspect = async (prisma: Pick<PrismaClient, "hardwareItem">) => {
	const normalizedNames = mlhHardwareItems.map(item => normalizeHardwareName(item.name));
	const existing = await prisma.hardwareItem.findMany({
		where: {
			OR: [
				{ importKey: { in: mlhHardwareItems.map(item => item.importKey) } },
				{ normalizedName: { in: normalizedNames } },
			],
		},
		select: existingSelection,
	});
	return evaluateMlhHardwareImport(existing);
};

export const inspectMlhHardwareImport = (prisma: PrismaClient) => inspect(prisma);

export const applyMlhHardwareImport = (prisma: PrismaClient) =>
	prisma.$transaction(
		async tx => {
			const inspection = await inspect(tx);
			if (inspection.errors.length > 0) throw new Error(inspection.errors.join("\n"));
			if (inspection.alreadyApplied) return { ...inspection, changed: false };
			await tx.hardwareItem.createMany({
				data: mlhHardwareItems.map(item => {
					const expected = expectedFor(item);
					return {
						importKey: expected.importKey,
						category: expected.category,
						owner: expected.owner,
						name: expected.name,
						normalizedName: expected.normalizedName,
						inventoryMode: expected.inventoryMode,
						totalQuantity: expected.totalQuantity,
						availableQuantity: expected.availableQuantity,
						availableForCheckout: expected.availableForCheckout,
						consumptionAllowed: expected.consumptionAllowed,
						description: expected.description,
						imageURL: expected.imageURL,
					};
				}),
			});
			return { ...(await inspect(tx)), changed: true };
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
