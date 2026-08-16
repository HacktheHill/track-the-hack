import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { signIn } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";
import Error from "../../components/Error";
import Head from "../../components/Head";
import { getAuthOptions } from "../api/auth/[...nextauth]";

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return session
		? { redirect: { permanent: false, destination: "/" } }
		: { props: await serverSideTranslations(locale ?? "en", ["common", "auth"]) };
};

const SignIn = () => {
	const { t } = useTranslation("auth");
	const router = useRouter();
	const [callbackUrl] = [router.query.callbackUrl].flat();
	const [error] = [router.query.error].flat();

	return (
		<>
			<Head title={t("sign-in")} />
			<main className="flex h-screen flex-col items-center justify-center gap-6 bg-default-gradient p-4 text-center">
				<Image
					src="/assets/hackthehill-logo.svg"
					alt={t("common:hack-the-hill-logo-alt")}
					width={128}
					height={128}
				/>
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("organizer-sign-in")}</h1>
				<p className="font-rubik text-dark-color">{t("organizer-sign-in-help")}</p>
				<button
					type="button"
					onClick={() => void signIn("google", { callbackUrl: callbackUrl ?? "/" })}
					className="rounded-lg border border-dark-primary-color bg-light-quaternary-color px-6 py-3 font-coolvetica text-lg text-dark-primary-color"
				>
					{t("google-sign-in")}
				</button>
				{error && <Error message={t(`next-auth.${error}`)} />}
			</main>
		</>
	);
};

export default SignIn;
