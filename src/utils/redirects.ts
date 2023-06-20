import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { PrismaClient } from "@prisma/client";
import { Session } from "next-auth";

type ServerSideProps = {
	redirect?: { destination: any; permanent: boolean } | null;
	props: { [key: string]: any };
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
		props: await serverSideTranslations(locale ?? "en", ["common", "hackers"]),
	};
}
