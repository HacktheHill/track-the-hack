import { PrismaClient, RoleName } from "@prisma/client";

import { insertRecords } from "./utils.mjs";
import { events } from "./events.mjs";
import { generateHackers } from "./hackers.mjs";
import { generateUsers } from "./users.mjs";
import { generatePresences } from "./presences.mjs";

const prisma = new PrismaClient();

async function main() {
	console.info("Creating dummy roles...");
	await prisma.$transaction(
		Object.values(RoleName).map(name =>
			prisma.role.upsert({
				where: { name },
				update: {},
				create: { name },
			}),
		),
	);

	console.info("Creating dummy users...");
	const users = generateUsers(10);
	await insertRecords(prisma.user, users);

	console.info("Creating dummy events...");
	await insertRecords(prisma.event, events);

	/* const hardwareData = await hardware();
	console.info("Creating dummy hardware...");
	await insertRecords(prisma.hardware, hardwareData); */

	const hackers = generateHackers(10);
	console.info("Creating dummy hackers...");
	await insertRecords(prisma.hacker, hackers);

	const presences = generatePresences(10);
	console.info("Creating dummy presences...");
	await insertRecords(prisma.presence, presences);
}

main()
	.then(async () => {
		await prisma.$disconnect();
		console.info("Done!");
	})
	.catch(async e => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
