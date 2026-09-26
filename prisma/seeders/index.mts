import { PrismaClient } from "@prisma/client";

import { events } from "./events.mjs";
import { hackers } from "./hackers.mjs";
import { presences } from "./presences.mjs";

const prisma = new PrismaClient();
async function main() {
	console.info("Upserting development organizer...");
	await prisma.user.upsert({
		where: { email: "dev.organizer@ctn-rtc.org" },
		create: {
			name: "Dev Organizer",
			email: "dev.organizer@ctn-rtc.org",
			emailVerified: new Date("2026-01-01T00:00:00.000Z"),
			isAdmin: true,
		},
		update: {
			name: "Dev Organizer",
			emailVerified: new Date("2026-01-01T00:00:00.000Z"),
			isAdmin: true,
		},
	});

	console.info("Upserting development events...");
	await prisma.$transaction(
		events.map(({ id, ...data }) =>
			prisma.event.upsert({
				where: { id },
				create: { id, ...data },
				update: data,
			}),
		),
	);

	console.info("Upserting development participants...");
	await prisma.$transaction(
		hackers.map(({ id, ...data }) =>
			prisma.hacker.upsert({
				where: { id },
				create: { id, ...data },
				update: data,
			}),
		),
	);

	console.info("Upserting development presences...");
	await prisma.$transaction(
		presences.map(({ hackerId, eventId, ...data }) =>
			prisma.presence.upsert({
				where: { hackerId_eventId: { hackerId, eventId } },
				create: { hackerId, eventId, ...data },
				update: data,
			}),
		),
	);
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
