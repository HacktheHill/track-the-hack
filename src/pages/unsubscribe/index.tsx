import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import type { GetStaticProps, NextPage } from "next/types";
import { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
import FormPage from "../../components/FormPage";
import { trpc } from "../../utils/api";

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
			setIsUnsubscribed(query.data.unsubscribed ? true : false);
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
			path={query.data?.email ? `/unsubscribe?email=${query.data?.email}` : null}
			user={query.data ?? null}
			title={t("unsubscribe")}
		>
			<h3 className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark">
				{t("are-you-sure", {
					email: query.data?.email as string,
					unsubscribe: (isUnsubscribed ? t("resubscribe") : t("unsubscribe")).toLowerCase(),
				})}
			</h3>
			<button
				className="cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light px-[calc(2*clamp(0.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-rubik text-[clamp(1rem,1vmin,5rem)] text-white shadow-md transition-all duration-1000 hover:bg-medium"
				disabled={query.isLoading}
			>
				{isUnsubscribed ? t("resubscribe") : t("unsubscribe")}
			</button>
		</FormPage>
	);
};

export default Unsubscribe;
