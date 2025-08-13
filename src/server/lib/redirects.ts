import { PrismaClient, RoleName, AcceptanceStatus } from "@prisma/client";
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

	if (!user) {
		return {
			destination: `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
			permanent: false,
		};
	}

	// Allow if user already has required role(s)
	if (user.roles.some(role => role.name === RoleName.ORGANIZER || role.name === RoleName.HACKER)) {
		return; // no redirect
	}

	// If user does not yet have HACKER role but their application is accepted, allow access
	const hacker = await prisma.hacker.findFirst({
		where: { userId: user.id },
		select: { acceptanceStatus: true },
	});

	if (hacker?.acceptanceStatus === AcceptanceStatus.ACCEPTED) {
		return; // accepted hacker can access QR page even before role assignment
	}

	return {
		destination: "/",
		permanent: false,
	};
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
