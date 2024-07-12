import csv from "csvtojson";
import * as fs from "fs";

// Generates dummy users
const hardware = async () => {
	const headers = [
		//headers on the csv file
		"imageURL",
		"name",
		"quantityAvailable",
		"manufacturer",
		"model",
		"type",
		"description",
	];

	const hardwareInfo = csv({
		headers: headers,
		trim: true,
		delimiter: ",",
	});

	if (!fs.existsSync("prisma/hardwareinfo.csv")) {
		void fs.createReadStream("prisma/hardwareinfo.csv").pipe(hardwareInfo);
		const temp = await hardwareInfo;
		const hardware = temp.map(hardware => {
			const hardwareQuantityAvailable = parseInt(hardware.quantityAvailable);
			const hardwareInfo = {
				imageUrl: hardware.imageUrl,
				name: hardware.name,
				quantityAvailable: hardwareQuantityAvailable,
				manufacturer: hardware.manufacturer,
				model: hardware.model,
				type: hardware.type,
				description: hardware.description,
			};

			return hardwareInfo;
		});
		return hardware;
	} else {
		return [];
	}
};

export { hardware };
