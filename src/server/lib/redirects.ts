import { PrismaClient, type RoleName } from "@prisma/client";
import type { Session } from "next-auth";

export async function rolesRedirect(session: Session | null, callbackUrl: string, roles: RoleName[]) {
	const prisma = new PrismaClient();
	const user =
		session?.user &&
		(await prisma.user.findUnique({
			where: { id: session.user.id },
			select: { roles: { select: { name: true } } },
		}));

	if (!user) {
		return {
			destination: `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
			permanent: false,
		};
	}

	if (!user.roles.some(role => roles.includes(role.name))) {
		return { destination: callbackUrl.startsWith("/internal") ? "/internal" : "/", permanent: false };
	}
}
