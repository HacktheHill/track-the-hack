import { Role, Language,  } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import csv from "csvtojson";
import * as fs from "fs";
const prisma = new PrismaClient();


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

    void fs.createReadStream("prisma/hardwareinfo.csv").pipe(hardwareInfo);
	const temp = await hardwareInfo
	const hardware = temp.map(hardware => {
		const hardwareInfo =  
			{
                imageUrl: hardware.imageUrl,
				name: hardware.name,
				quantityAvailable: hardware.quantityAvailable,
				manufacturer: hardware.manufacturer,
				model: hardware.model,
				type: hardware.type,
				description: hardware.description,
            };

			return hardwareInfo;
	});


	return hardware;
};

export {hardware}