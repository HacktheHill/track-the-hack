import { PrismaClient } from "@prisma/client";
// This standalone production-image entrypoint cannot resolve the application's TypeScript alias.
// eslint-disable-next-line no-restricted-imports
import { hasOrganizerEmailDomain, isNamedCtnOrganizerEmail } from "../src/server/lib/organizer-auth.ts";
// eslint-disable-next-line no-restricted-imports
import { parseOrganizerProvisionInput } from "../src/server/lib/organizer-provision.ts";

const prisma = new PrismaClient();
const { email, admin } = parseOrganizerProvisionInput(process.argv.slice(2), process.env);
if (hasOrganizerEmailDomain(email) && !isNamedCtnOrganizerEmail(email)) {
	throw new Error("CTN organiser accounts must use firstname.lastname@ctn-rtc.org");
}
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
