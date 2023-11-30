import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";
import type { SSRConfig } from "next-i18next";

type ServerSideProps = {
	redirect?: {
		destination: string;
		permanent: boolean;
	};
	props: SSRConfig;
};

export async function hackersRedirect(session: Session | null, locale: string | undefined): Promise<ServerSideProps> {
	const prisma = new PrismaClient();

	const user =
		session &&
		(await prisma.user.findUnique({
			where: {
				id: session.user?.id,
			},
		}));

	if (!user) {
		return {
			redirect: {
				destination: "/api/auth/signin",
				permanent: false,
			},
			props: {},
		};
	}

	if (user.role !== "ORGANIZER") {
		return {
			redirect: {
				destination: "/",
				permanent: false,
			},
			props: {},
		};
	}

	return {
		props: {}
	};
}
