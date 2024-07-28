import { PrismaClient, RoleName } from "@prisma/client";
import type { Session } from "next-auth";

export async function qrRedirect(session: Session | null, callbackUrl: string) {
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
		const hacker = await prisma.hacker.findFirst({
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

// Allow organizers to view all, hackers to view only themselves
export async function hackerRedirect(session: Session | null, callbackUrl: string, hackerId: string) {
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

	if (user?.roles.map(role => role.name).includes(RoleName.HACKER)) {
		const hacker = await prisma.hacker.findFirst({
			where: {
				userId: user.id,
			},
		});

		if (!hacker || hacker.id !== hackerId) {
			return {
				destination: "/",
				permanent: false,
			};
		}
	}

	if (!user.roles.map(role => role.name).includes(RoleName.ORGANIZER)) {
		return {
			destination: "/",
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
