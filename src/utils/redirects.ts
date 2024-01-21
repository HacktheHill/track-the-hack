import { PrismaClient, Role } from "@prisma/client";
import type { Session } from "next-auth";

type ServerSideProps = {
	redirect?: {
		destination: string;
		permanent: boolean;
	};
	props?: Record<string, unknown>;
};

export async function hackersRedirect(session: Session | null): Promise<ServerSideProps> {
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
				redirect: {
					destination: "/",
					permanent: false,
				},
			};
		}
	}

	if (!user) {
		return {
			redirect: {
				destination: "/api/auth/signin",
				permanent: false,
			},
		};
	}

	return {};
}
