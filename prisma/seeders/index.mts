import { PrismaClient } from "@prisma/client";

import { insertRecords } from "./utils.mjs";

import { generateUsers } from "./users.mjs";
import { generateHackerInfos } from "./hackerInfos.mjs";
import { events } from "./events.mjs";

const prisma = new PrismaClient();

async function main() {
	console.log("Creating dummy users...");

	const users = generateUsers(10);
	await insertRecords(prisma.user, users);

	console.log("Creating dummy hackers info...");

	const hackerInfos = generateHackerInfos(30);
	await insertRecords(prisma.hackerInfo, hackerInfos);

	//seed events table
	console.log("Creating dummy events...");
	await insertRecords(prisma.event, events);
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
