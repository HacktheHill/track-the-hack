import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Image from "next/image";
import { useEffect, useState } from "react";
import Error from "@/components/Error";
import Head from "@/components/Head";
import { parseOrganizerEmailConfirmationFragment } from "@/server/lib/organizer-email-confirmation";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["common", "auth"]),
});

type Confirmation = NonNullable<ReturnType<typeof parseOrganizerEmailConfirmationFragment>>;

const VerifyEmail = () => {
	const { t } = useTranslation("auth");
	const [confirmation, setConfirmation] = useState<Confirmation | null>();

	useEffect(() => {
		setConfirmation(parseOrganizerEmailConfirmationFragment(window.location.hash, window.location.origin));
	}, []);

	return (
		<>
			<Head title={t("verify-email-title")} noIndex />
			<main className="ui-auth-page bg-default-gradient">
				<Image
					src="/assets/hackthehill-logo.svg"
					alt={t("common:hack-the-hill-logo-alt")}
					width={130}
					height={78}
				/>
				<h1 className="ui-page-title">{t("verify-email-title")}</h1>
				{confirmation === undefined ? (
					<p className="font-rubik text-dark-color" role="status">
						{t("verify-email-loading")}
					</p>
				) : confirmation ? (
					<>
						<p className="max-w-sm text-center font-rubik text-dark-color">
							{t("verify-email-help", { email: confirmation.email })}
						</p>
						<button
							type="button"
							className="ui-button ui-button-primary"
							onClick={() => window.location.assign(confirmation.verificationUrl)}
						>
							{t("verify-email-continue")}
						</button>
					</>
				) : (
					<Error message={t("verify-email-invalid")} />
				)}
			</main>
		</>
	);
};

export default VerifyEmail;
