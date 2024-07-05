import { PrismaClient } from "@prisma/client";

import { insertRecords } from "./utils.mjs";

import { generateUsers } from "./users.mjs";
import { generateHackerInfos } from "./hackerInfos.mjs";
import { generatePresenceInfos } from "./presenceInfos.mjs";
import { events } from "./events.mjs";
import { hackers } from "./hackers.mjs";
const prisma = new PrismaClient();

async function main() {
	// console.log("Creating dummy users...");

	// const users = generateUsers(10);
	// await insertRecords(prisma.user, users);

	// //seed events table
	// console.log("Creating dummy events...");
	// await insertRecords(prisma.event, events);

	// console.log("uploading hacker infos to the app");
	// const hackerInfos = uploadHackers(prisma.hackerInfo, hackers);

	const hackerInfos = generateHackerInfos(10);
	await insertRecords(prisma.hackerInfo, hackerInfos);

	console.log("Creating dummy presence info...");

	const presenceInfos = generatePresenceInfos(30);
	await insertRecords(prisma.presenceInfo, presenceInfos);
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
