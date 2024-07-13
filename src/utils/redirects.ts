import { PrismaClient, Role } from "@prisma/client";
import type { Session } from "next-auth";

export async function hackersRedirect(session: Session | null, callbackUrl: string) {
	const prisma = new PrismaClient();

	const user =
		session &&
		(await prisma.user.findUnique({
			where: {
				id: session.user?.id,
			},
		}));

	if (user && user.role === Role.HACKER) {
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

	return {};
}
