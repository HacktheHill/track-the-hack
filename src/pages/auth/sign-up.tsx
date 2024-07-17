import type { GetStaticProps, NextPage } from "next";
import { signIn } from "next-auth/react";
import { Trans, useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import FormPage from "../../components/FormPage";
import { trpc } from "../../server/api/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "auth"]),
	};
};

const SignUp: NextPage = () => {
	const { t } = useTranslation("auth");

	const router = useRouter();

	const mutation = trpc.users.signUp.useMutation();

	const [email, setEmail] = useState<string>();
	const [provider, setProvider] = useState<string>();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const { email, provider } = router.query;
		if (typeof email === "string") {
			setEmail(decodeURIComponent(email));
		}
		if (typeof provider === "string") {
			setProvider(provider);
		}
	}, [router.query]);

	const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!email) return;

		setLoading(true);

		await mutation.mutateAsync({ email });

		await signIn(provider, {
			email,
			callbackUrl: "/",
			redirect: true,
		});
	};

	return (
		<FormPage
			title={t("sign-up")}
			loading={mutation.isLoading || loading}
			invalid={!email ? t("no-email") : mutation.error?.message ?? ""}
			path={`/auth/sign-up`}
			user={null}
			onSubmit={e => void handleSignUp(e)}
		>
			<h3 className="font-rubik text-4xl font-bold text-dark-color">{t("sign-up")}</h3>
			<p className="font-rubik text-dark-color">
				<Trans i18nKey="confirm" t={t} values={{ email }} />
			</p>
			<button className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base">
				{t("yes-and-sign-in")}
			</button>
		</FormPage>
	);
};

export default SignUp;
