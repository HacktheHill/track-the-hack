import { PrismaClient, RoleName } from "@prisma/client";
import { hasOrganizerEmailDomain, normalizeOrganizerEmail } from "../src/server/lib/organizer-auth";

const prisma = new PrismaClient();
const [rawEmail, ...rawRoles] = process.argv.slice(2);

if (!rawEmail || !hasOrganizerEmailDomain(rawEmail)) {
	throw new Error("Usage: npm run organizer:provision -- organizer@ctn-rtc.org [ROLE ...]");
}

const email = normalizeOrganizerEmail(rawEmail);
const roles = rawRoles.length ? rawRoles : [RoleName.ORGANIZER];
if (!roles.every((role): role is RoleName => Object.values(RoleName).includes(role as RoleName))) {
	throw new Error(`Roles must be one of: ${Object.values(RoleName).join(", ")}`);
}

await prisma.$transaction([
	...roles.map(name => prisma.role.upsert({ where: { name }, create: { name }, update: {} })),
	prisma.user.upsert({
		where: { email },
		create: { email, roles: { connect: roles.map(name => ({ name })) } },
		update: { roles: { set: roles.map(name => ({ name })) } },
	}),
]);
await prisma.$disconnect();
console.info(`Provisioned organizer ${email} with roles ${roles.join(", ")}.`);
