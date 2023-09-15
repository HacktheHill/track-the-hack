import { PrismaClient } from "@prisma/client";

import { insertRecords } from "./utils.mjs";

import { generateUsers } from "./users.mjs";
import { events } from "./events.mjs";

const prisma = new PrismaClient();

async function main() {
	console.log("Creating dummy users...");

	const users = generateUsers(10);
	await insertRecords(prisma.user, users);

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
