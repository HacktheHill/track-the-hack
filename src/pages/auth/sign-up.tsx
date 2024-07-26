import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth";
import { getProviders, signIn } from "next-auth/react";
import { Trans, useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import Error from "../../components/Error";
import Head from "../../components/Head";
import Loading from "../../components/Loading";
import { trpc } from "../../server/api/api";
import { getAuthOptions } from "../api/auth/[...nextauth]";

type Providers = Record<string, { id: string; name: string }>;

export const getServerSideProps: GetServerSideProps<{ providers: Providers }> = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));

	// If the user is already logged in
	if (session) {
		return { redirect: { permanent: false, destination: "/" } };
	}

	// If there is no email in the query
	if (new URLSearchParams(req.url).get("email") === null) {
		return { redirect: { permanent: false, destination: "/auth/sign-in" } };
	}

	const providers = (await getProviders()) ?? ({} as Providers);

	return {
		props: {
			providers,
			...(await serverSideTranslations(locale ?? "en", ["common", "auth"])),
		},
	};
};

const SignUp = ({ providers }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
	const { t } = useTranslation("auth");
	const router = useRouter();

	const [error] = [router.query.error].flat();
	const [noUser] = [router.query["no-user"]].flat();
	const email = decodeURIComponent([router.query.email].flat()[0] ?? "");

	const mutation = trpc.users.signUp.useMutation();

	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, providerId: string) => {
		e.preventDefault();
		const formData = new FormData(e.target as HTMLFormElement);

		if (!email) return;

		setLoading(true);

		await mutation.mutateAsync({ email });

		if (providerId === "email") {
			void signIn(providerId, {
				email: formData.get("email"),
				redirectTo: "/",
			});
		} else {
			void signIn(providerId, {
				callbackUrl: "/",
			});
		}
	};

	if (!providers) {
		return <Error message={t("no-auth-providers")} />;
	}

	return (
		<>
			<Head title={t("sign-up")} />
			<main className="flex h-screen flex-col items-center justify-center gap-4 bg-default-gradient bg-no-repeat text-center supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
				<div className="flex flex-col items-center">
					<Image
						src="https://hackthehill.com/Logos/hackthehill-logo.svg"
						alt={t("common:hack-the-hill-logo-alt")}
						width={128}
						height={128}
						className="h-auto w-auto"
						priority
					/>
					<h1 className="font-coolvetica text-[clamp(1rem,3.5vmin,5rem)] font-normal text-dark-color">
						{t("sign-up")}
					</h1>
				</div>
				<div className="flex w-fit flex-col gap-4">
					{noUser && <p className="w-96 text-dark-color">{t("no-user-sign-up")}</p>}
					{email}
					{Object.values(providers).map(provider => (
						<form
							key={provider.id}
							className="flex gap-2"
							onSubmit={e => void handleSubmit(e, provider.id)}
						>
							{provider.id === "email" && (
								<input
									type="email"
									name="email"
									placeholder={t("email-address")}
									required
									className="rounded-lg border border-dark-primary-color bg-light-primary-color px-4 py-2 font-rubik text-lg text-light-color shadow-md transition-all duration-500 placeholder:text-light-quaternary-color hover:bg-light-primary-color/75 hover:shadow-lg"
								/>
							)}
							<button
								type="submit"
								className="flex w-full justify-center gap-4 whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-lg text-dark-primary-color transition-all duration-500 hover:bg-light-tertiary-color hover:shadow-lg"
							>
								{provider.id !== "email" && (
									<>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={`https://authjs.dev/img/providers/${provider.id}.svg`}
											alt={provider.name}
											className="h-8 w-auto brightness-0"
										/>
									</>
								)}
								<span>{provider.name}</span>
							</button>
						</form>
					))}

					{error && <Error message={error} />}
					{loading && <Loading />}
				</div>
			</main>
		</>
	);
};

export default SignUp;
