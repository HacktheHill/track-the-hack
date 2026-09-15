import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth";
import { getProviders, signIn } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import Error from "../../components/Error";
import Head from "../../components/Head";
import Loading from "../../components/Loading";
import Modal from "../../components/Modal";
import { trpc } from "../../server/api/api";
import { passwordSchema } from "../../utils/common";
import { getAuthOptions } from "../api/auth/[...nextauth]";

type Providers = Record<string, { id: string; name: string }>;

export const getServerSideProps: GetServerSideProps<{ providers: Providers }> = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));

	// If the user is already logged in
	if (session) {
		return { redirect: { permanent: false, destination: "/" } };
	}

	const providers = (await getProviders()) ?? ({} as Providers);

	return {
		props: {
			providers,
			...(await serverSideTranslations(locale ?? "en", ["common", "auth", "zod"])),
		},
	};
};

const SignUp = ({ providers }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
	const { t } = useTranslation("auth");
	const router = useRouter();
	const [noUser] = [router.query["no-user"]].flat();

	const mutation = trpc.users.signUp.useMutation();

	const [submissionData, setSubmissionData] = useState<{
		formData: FormData | null;
		providerId: string | null;
	}>({ formData: null, providerId: null });

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showConfirmation, setShowConfirmation] = useState(false);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>, providerId: string) => {
		e.preventDefault();
		const formData = new FormData(e.target as HTMLFormElement);

		if (providerId === "credentials") {
			const password = formData.get("password") as string;
			const passwordValidation = passwordSchema.safeParse(password);
			if (!passwordValidation.success) {
				setError(t("password-strength"));
				setShowConfirmation(false);
				return;
			}
		}

		setSubmissionData({ formData, providerId });
		setShowConfirmation(true);
	};

	const handleSignUp = async () => {
		const { formData, providerId } = submissionData;
		if (!formData || !providerId) return;

		const email = (formData.get("email") as string) ?? router.query.email;
		const password = (formData.get("password") as string) ?? undefined;

		setLoading(true);

		if (email) {
			await mutation.mutateAsync({ email, password });
		}

		if (providerId === "credentials") {
			void signIn(providerId, {
				email: email,
				password: password,
				redirectTo: "/",
			});
		} else if (providerId === "email") {
			void signIn(providerId, {
				email,
				redirectTo: "/",
			});
		} else {
			void signIn(providerId, {
				callbackUrl: "/",
			});
		}
	};

	useEffect(() => {
		if (router.query.error) {
			setError(t(`next-auth.${router.query.error as string}`));
		}
		if (mutation.error) {
			setError(mutation.error.message);
		}
	}, [mutation.error, router.query.error, t]);

	if (!providers) {
		return <Error message={t("no-auth-providers")} />;
	}

	return (
		<>
			<Head title={t("sign-up")} />
			<main className="ui-auth-page bg-default-gradient bg-no-repeat">
				<div className="flex flex-col items-center">
					<Image
						src="/assets/hackthehill-logo.svg"
						alt={t("common:hack-the-hill-logo-alt")}
						width={128}
						height={128}
						className="h-auto w-24"
						priority
					/>
					<h1 className="ui-page-title">{t("sign-up")}</h1>
				</div>
				<div className="flex w-full max-w-md flex-col gap-4">
					{noUser && (
						<p className="text-dark-color">
							{t("no-user", {
								email: router.query.email,
							})}
						</p>
					)}
					{Object.values(providers).map(provider => (
						<form
							key={provider.id}
							className="ui-auth-form"
							onSubmit={e => void handleSubmit(e, provider.id)}
						>
							{provider.id === "email" && (
								<>
									<label htmlFor={`${provider.id}-email`}>{t("email-address")}</label>
									<input
										id={`${provider.id}-email`}
										autoComplete="email"
										type="email"
										name="email"
										placeholder={t("email-address")}
										required
										className="ui-field w-full"
									/>
								</>
							)}
							{provider.id === "credentials" && (
								<>
									<label htmlFor={`${provider.id}-email`}>{t("email-address")}</label>
									<input
										id={`${provider.id}-email`}
										autoComplete="email"
										type="email"
										name="email"
										placeholder={t("email-address")}
										required
										className="ui-field w-full"
									/>
									<label htmlFor={`${provider.id}-password`}>{t("password")}</label>
									<input
										id={`${provider.id}-password`}
										autoComplete="new-password"
										type="password"
										name="password"
										placeholder={t("password")}
										required
										className="ui-field w-full"
									/>
								</>
							)}
							<button type="submit" className="ui-button ui-button-primary w-full">
								{provider.id !== "email" && provider.id !== "credentials" && (
									<>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={`https://authjs.dev/img/providers/${provider.id}.svg`}
											alt={provider.name}
											className="h-6 w-6 brightness-0 invert"
										/>
									</>
								)}
								{provider.id === "email" && t("email-sign-up")}
								{provider.id === "credentials" && t("credentials-sign-up")}
								{provider.id !== "email" && provider.id !== "credentials" && provider.name}
							</button>
						</form>
					))}
					{error && <Error message={error} />}
				</div>
				{showConfirmation && (
					<Modal
						buttons={[
							{
								label: t("confirm"),
								onClick: () => void handleSignUp(),
							},
							{
								label: t("sign-in-instead"),
								onClick: () => void router.push("/auth/sign-in"),
							},
						]}
					>
						<h3 className="text-dark-color">{t("sign-up-confirmation")}</h3>
						{loading && <Loading />}
					</Modal>
				)}
			</main>
		</>
	);
};

export default SignUp;
