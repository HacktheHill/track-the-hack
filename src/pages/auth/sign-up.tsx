import type { GetStaticProps, NextPage } from "next";
import { signIn } from "next-auth/react";
import { useTranslation, Trans } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { trpc } from "../../utils/api";
import FormPage from "../../components/FormPage";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "sign-up"]),
	};
};

const SignUp: NextPage = () => {
	const { t } = useTranslation("sign-up");

	const router = useRouter();

	const mutation = trpc.users.signUp.useMutation();

	const [email, setEmail] = useState<string>();

	useEffect(() => {
		const { email } = router.query;
		if (typeof email === "string") {
			setEmail(decodeURIComponent(email));
		}
	}, [router.query]);

	const handleSignUp = () => {
		if (!email) return;

		mutation.mutate({ email });

		void signIn(undefined, {
			callbackUrl: "/",
			email: email,
		});
	};

	return (
		<FormPage
			title={t("title")}
			loading={mutation.isLoading}
			invalid={!email ? t("no-email") : mutation.error?.message ?? ""}
			path={`/auth/sign-up`}
			user={null}
			onSubmit={handleSignUp}
		>
			<h3 className="font-rubik text-4xl font-bold text-dark-color">{t("title")}</h3>
			<p className="font-rubik text-dark-color">
				<Trans i18nKey="confirm" t={t} values={{ email }} />
			</p>
			<button className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base">
				{t("continue")}
			</button>
		</FormPage>
	);
};

export default SignUp;
