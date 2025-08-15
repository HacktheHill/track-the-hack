import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth";
import { getProviders, signIn } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useRouter } from "next/router";

import Error from "../../components/Error";
import Head from "../../components/Head";
import { getAuthOptions } from "../api/auth/[...nextauth]";

type Providers = Record<string, { id: string; name: string }>;

export const getServerSideProps: GetServerSideProps<{ providers: Providers }> = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));

	// If the user is already logged in
	if (session) {
		const callbackUrl = req.url ? new URL(req.url, process.env.NEXTAUTH_URL).searchParams.get("callbackUrl") : null;
		return {
			redirect: {
				permanent: false,
				destination: callbackUrl ?? "/",
			},
		};
	}

	const providers = (await getProviders()) ?? ({} as Providers);

	return {
		props: {
			providers,
			...(await serverSideTranslations(locale ?? "en", ["common", "auth"])),
		},
	};
};

const SignIn = ({ providers }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
	const { t } = useTranslation("auth");
	const router = useRouter();
	const [callbackUrl] = [router.query.callbackUrl].flat();
	const [error] = [router.query.error].flat();

	if (!providers) {
		return <Error message={t("no-auth-providers")} />;
	}

	return (
		<>
			<Head title={t("sign-in")} />
			<main className="flex h-screen flex-col items-center justify-center gap-4 bg-default-gradient bg-no-repeat p-4 text-center supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh]">
				<div className="flex flex-col items-center">
					<Image
						src="/assets/hackthehill-logo.svg"
						alt={t("common:hack-the-hill-logo-alt")}
						width={192}
						height={192}
						priority
					/>
					<h1 className="font-coolvetica text-[clamp(1rem,3.5vmin,5rem)] font-normal text-dark-color">
						{t("sign-in")}
					</h1>
				</div>
				<div className="flex w-full max-w-md flex-col gap-4">
					{Object.values(providers).map(provider => (
						<form
							key={provider.id}
							className="flex flex-wrap gap-4 mobile:flex-nowrap"
							onSubmit={e => {
								e.preventDefault();
								const formData = new FormData(e.target as HTMLFormElement);
								if (provider.id === "email") {
									void signIn(provider.id, {
										email: formData.get("email"),
										redirectTo: callbackUrl,
									});
								} else if (provider.id === "credentials") {
									void signIn(provider.id, {
										email: formData.get("email") as string,
										password: formData.get("password") as string,
										redirectTo: callbackUrl,
									});
								} else {
									void signIn(provider.id, { callbackUrl });
								}
							}}
						>
							{provider.id === "email" && (
								<input
									type="email"
									name="email"
									placeholder={t("email-address")}
									required
									className="w-full rounded-lg border border-dark-primary-color bg-light-primary-color px-4 py-2 font-rubik text-lg text-light-color shadow-md transition-all duration-500 placeholder:text-light-quaternary-color hover:bg-light-primary-color/75 hover:shadow-lg"
								/>
							)}
							{provider.id === "credentials" && (
								<>
									<input
										type="email"
										name="email"
										placeholder={t("email-address")}
										required
										className="w-full rounded-lg border border-dark-primary-color bg-light-primary-color px-4 py-2 font-rubik text-lg text-light-color shadow-md transition-all duration-500 placeholder:text-light-quaternary-color hover:bg-light-primary-color/75 hover:shadow-lg"
									/>
									<input
										type="password"
										name="password"
										placeholder={t("password")}
										required
										className="w-full rounded-lg border border-dark-primary-color bg-light-primary-color px-4 py-2 font-rubik text-lg text-light-color shadow-md transition-all duration-500 placeholder:text-light-quaternary-color hover:bg-light-primary-color/75 hover:shadow-lg"
									/>
								</>
							)}
							<button
								type="submit"
								className="flex w-full justify-center gap-4 whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-lg text-dark-primary-color transition-all duration-500 hover:bg-light-tertiary-color hover:shadow-lg"
							>
								{provider.id !== "email" && provider.id !== "credentials" && (
									<>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={`https://authjs.dev/img/providers/${provider.id}.svg`}
											alt={provider.name}
											className="h-8 w-auto brightness-0"
										/>
									</>
								)}
								{provider.id === "email" && t("email-sign-in")}
								{provider.id === "credentials" && t("credentials-sign-in")}
								{provider.id !== "email" && provider.id !== "credentials" && provider.name}
							</button>
						</form>
					))}
					{error && <Error message={t(`next-auth.${error}`)} />}
				</div>
			</main>
		</>
	);
};

export default SignIn;
