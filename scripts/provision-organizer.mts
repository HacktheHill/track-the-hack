import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hasOrganizerEmailDomain, normalizeOrganizerEmail } from "@/server/lib/organizer-auth";

const prisma = new PrismaClient();
const [rawEmail, rawMode] = process.argv.slice(2);
const parsedEmail = z.string().trim().email().max(191).safeParse(rawEmail);
if (!parsedEmail.success || (rawMode !== undefined && rawMode !== "--admin")) {
	throw new Error("Usage: npm run organizer:provision -- organizer@example.com [--admin]");
}

const email = normalizeOrganizerEmail(parsedEmail.data);
const admin = rawMode === "--admin";
if (admin && !hasOrganizerEmailDomain(email)) {
	throw new Error("Administrators must use a CTN email address");
}

try {
	if (admin) {
		await prisma.user.upsert({
			where: { email },
			create: { email, isAdmin: true },
			update: { isAdmin: true },
		});
		const verified = await prisma.user.findUnique({ where: { email }, select: { id: true, isAdmin: true } });
		if (!verified?.isAdmin) throw new Error("Administrator grant verification failed");
		console.info(`Granted administrator access to ${email}.`);
	} else if (hasOrganizerEmailDomain(email)) {
		console.info(`${email} already has organiser access through CTN Google Workspace.`);
	} else {
		await prisma.organizerAccess.upsert({
			where: { email },
			create: { email, createdById: "cli" },
			update: {},
		});
		const verified = await prisma.organizerAccess.findUnique({ where: { email }, select: { id: true } });
		if (!verified) throw new Error("Organiser access verification failed");
		console.info(`Allowed organiser email ${email}.`);
	}
} finally {
	await prisma.$disconnect();
}
