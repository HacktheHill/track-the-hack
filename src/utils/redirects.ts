import { PrismaClient, RoleName } from "@prisma/client";
import type { Session } from "next-auth";

export async function hackersRedirect(session: Session | null, callbackUrl: string) {
	const prisma = new PrismaClient();

	const user =
		session &&
		(await prisma.user.findUnique({
			where: {
				id: session.user?.id,
			},
			select: {
				id: true,
				roles: true,
			},
		}));

	if (user?.roles.map(role => role.name).includes(RoleName.HACKER)) {
		const hacker = await prisma.hackerInfo.findFirst({
			where: {
				userId: user.id,
			},
		});

		if (!hacker) {
			return {
				destination: "/",
				permanent: false,
			};
		}
	}

	if (!user) {
		return {
			destination: `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
			permanent: false,
		};
	}
}

export async function rolesRedirect(session: Session | null, callbackUrl: string, roles: RoleName[]) {
	const prisma = new PrismaClient();

	const user =
		session &&
		(await prisma.user.findUnique({
			where: {
				id: session.user?.id,
			},
			select: {
				id: true,
				roles: true,
			},
		}));

	if (!user) {
		return {
			destination: `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
			permanent: false,
		};
	}

	if (!user.roles.map(role => role.name).some(role => roles.includes(role))) {
		return {
			destination: callbackUrl.startsWith("/internal") ? "/internal" : "/",
			permanent: false,
		};
	}
}

export function sessionRedirect(session: Session | null, callbackUrl: string) {
	if (!session) {
		return {
			destination: `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
			permanent: false,
		};
	}
}
