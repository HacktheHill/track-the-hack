import { PrismaClient } from "@prisma/client";

import { insertRecords } from "./utils.mjs";

import { events } from "./events.mjs";
import { generateHackerInfos } from "./hackerInfos.mjs";
import { hardware } from "./hardware.mjs";
import { generateUsers } from "./users.mjs";

const prisma = new PrismaClient();

async function main() {
	console.log("Creating dummy users...");
	const users = generateUsers(10);
	await insertRecords(prisma.user, users);

	console.log("Creating dummy events...");
	await insertRecords(prisma.event, events);

	const hardwareData = await hardware();
	console.log("Creating dummy hardware...");
	await insertRecords(prisma.hardware, hardwareData);

	const hackerInfos = generateHackerInfos(10);
	console.log("Creating dummy hacker info...");
	await insertRecords(prisma.hackerInfo, hackerInfos);
}

main()
	.then(async () => {
		await prisma.$disconnect();
		console.log("Done!");
	})
	.catch(async e => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
