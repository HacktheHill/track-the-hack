import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth";
import { signIn } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";
import Error from "@/components/Error";
import Head from "@/components/Head";
import { getAuthOptions } from "@/pages/api/auth/[...nextauth]";
import { DEVELOPMENT_AUTH_PROVIDER_ID, isDevelopmentOrganizerAuthEnabled } from "@/server/lib/organizer-auth";

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions());
	return session
		? { redirect: { permanent: false, destination: "/" } }
		: {
				props: {
					...(await serverSideTranslations(locale ?? "en", ["common", "auth"])),
					developmentAuthEnabled: isDevelopmentOrganizerAuthEnabled(
						process.env,
						req.headers.host,
						req.socket.remoteAddress,
					),
				},
			};
};

const SignIn = ({ developmentAuthEnabled }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
	const { t } = useTranslation("auth");
	const router = useRouter();
	const [callbackUrl] = [router.query.callbackUrl].flat();
	const [error] = [router.query.error].flat();
	const [email, setEmail] = useState("");
	const [emailSent, setEmailSent] = useState(false);
	const [emailPending, setEmailPending] = useState(false);
	const errorMessage =
		error === "AccessDenied" || error === "OAuthAccountNotLinked"
			? t(`next-auth.${error}`)
			: t("next-auth.Default");

	return (
		<>
			<Head title={t("sign-in")} />
			<main className="ui-auth-page bg-default-gradient">
				<Image
					src="/assets/hackthehill-logo.svg"
					alt={t("common:hack-the-hill-logo-alt")}
					width={128}
					height={128}
				/>
				<h1 className="ui-page-title">{t("organizer-sign-in")}</h1>
				<p className="font-rubik text-dark-color">{t("organizer-sign-in-help")}</p>
				<button
					type="button"
					onClick={() => void signIn("google", { callbackUrl: callbackUrl ?? "/" })}
					className="ui-button ui-button-primary"
				>
					{t("google-sign-in")}
				</button>
				<div className="flex w-full max-w-sm items-center gap-3" aria-hidden="true">
					<span className="h-px flex-1 bg-dark-primary-color/30" />
					<span className="font-rubik text-dark-color">{t("common:or")}</span>
					<span className="h-px flex-1 bg-dark-primary-color/30" />
				</div>
				<form
					className="flex w-full max-w-sm flex-col gap-3"
					onSubmit={event => {
						event.preventDefault();
						setEmailPending(true);
						void signIn("email", { email, callbackUrl: callbackUrl ?? "/", redirect: false }).finally(
							() => {
								setEmailPending(false);
								setEmailSent(true);
							},
						);
					}}
				>
					<label htmlFor="organizer-sign-in-email" className="sr-only">
						{t("email")}
					</label>
					<input
						id="organizer-sign-in-email"
						type="email"
						required
						maxLength={191}
						autoComplete="email"
						value={email}
						onChange={event => setEmail(event.target.value)}
						placeholder={t("email")}
						className="ui-field"
					/>
					<button type="submit" disabled={emailPending} className="ui-button ui-button-primary">
						{t("email-sign-in")}
					</button>
				</form>
				{emailSent && (
					<p className="max-w-sm font-rubik text-dark-color" role="status">
						{t("email-sent")}
					</p>
				)}
				{developmentAuthEnabled && (
					<button
						type="button"
						onClick={() => void signIn(DEVELOPMENT_AUTH_PROVIDER_ID, { callbackUrl: callbackUrl ?? "/" })}
						className="ui-button ui-button-primary"
					>
						{t("local-organizer-sign-in")}
					</button>
				)}
				{error && <Error message={errorMessage} />}
			</main>
		</>
	);
};

export default SignIn;
