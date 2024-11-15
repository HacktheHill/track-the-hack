import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import type { GetStaticProps, NextPage } from "next/types";
import { useEffect, useState } from "react";
import FormPage from "../../components/FormPage";
import { trpc } from "../../server/api/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "unsubscribe"]),
	};
};

const Unsubscribe: NextPage = () => {
	const { t } = useTranslation("unsubscribe");

	// Get query params
	const router = useRouter();
	const email = [router.query.email].flat()[0];
	const unsubscribeToken = [router.query.unsubscribeToken].flat()[0] ?? null;

	const mutation = trpc.hackers.unsubscribe.useMutation();

	const query = trpc.hackers.get.useQuery({ email: email ?? "" }, { enabled: !!email });

	const [isUnsubscribed, setIsUnsubscribed] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (query.data) {
			setIsUnsubscribed(!!query.data.unsubscribed);
		}
		if (query.error) {
			setError(query.error.message);
		}
		if (mutation.error) {
			if (mutation.error.message === "invalid-unsubscribe-token") {
				setError(t("invalid-unsubscribe-token"));
			} else {
				setError(mutation.error.message);
			}
		}
	}, [query.data, query.error, mutation.error, t]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!email) return;

		mutation.mutate({
			email,
			unsubscribeToken,
			unsubscribe: !isUnsubscribed,
		});

		setIsUnsubscribed(!isUnsubscribed);
	};

	return (
		<FormPage
			onSubmit={handleSubmit}
			error={error}
			invalid={!email || query.data === null ? t("invalid-email") : null}
			loading={email != null && query.isLoading && !query.isError}
			title={t("unsubscribe")}
		>
			<h3 className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
				{t("are-you-sure", {
					email: query.data?.email,
					unsubscribe: (isUnsubscribed ? t("resubscribe") : t("unsubscribe")).toLowerCase(),
				})}
			</h3>
			<button
				className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
				disabled={query.isLoading}
			>
				{isUnsubscribed ? t("resubscribe") : t("unsubscribe")}
			</button>
		</FormPage>
	);
};

export default Unsubscribe;
