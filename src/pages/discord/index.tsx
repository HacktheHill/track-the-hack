import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import type { GetStaticProps, NextPage } from "next";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import FormPage from "../../components/FormPage";
import { trpc } from "../../server/api/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "discord"]),
	};
};

const Discord: NextPage = () => {
	const { t } = useTranslation("discord");
	const { data: sessionData } = useSession();
	const router = useRouter();
	const discordId = [router.query.id].flat()[0];

	const mutation = trpc.users.verifyDiscord.useMutation();
	const [isVerified, setIsVerified] = useState(false);
	const [error, setError] = useState("");
	const [validationMessage, setValidationMessage] = useState("");

	useEffect(() => {
		if (mutation.error) {
			setError(mutation.error.message);
		}
		if (mutation.data) {
			setIsVerified(mutation.data);
		}
	}, [mutation.data, mutation.error]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!sessionData?.user?.id) {
			setValidationMessage(t("you-must-be-logged-in"));
			return;
		}

		if (!discordId) {
			setValidationMessage(t("missing-discord-id"));
			return;
		}

		mutation.mutate({ discordId });
		setIsVerified(true);
	};

	return (
		<FormPage
			onSubmit={handleSubmit}
			error={error}
			invalid={!discordId ? t("invalid-discord-id") : null}
			loading={discordId != null && mutation.isLoading && !mutation.isError}
			title={t("title")}
		>
			<h3 className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">{t("title")}</h3>
			{!sessionData?.user ? (
				<>
					<h3 className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
						{t("please-sign-in")}
					</h3>
					{validationMessage && <p className="text-red-500">{validationMessage}</p>}
					<button
						className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
						onClick={() => void signIn()}
					>
						{t("sign-in")}
					</button>
				</>
			) : isVerified ? (
				<p className="text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">{t("success-welcome")}</p>
			) : (
				<>
					<p className="text-center">{t("verify-details")}</p>
					{validationMessage && <p className="text-red-500">{validationMessage}</p>}
					<button
						type="submit"
						className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
					>
						{t("verify")}
					</button>
				</>
			)}
		</FormPage>
	);
};

export default Discord;
