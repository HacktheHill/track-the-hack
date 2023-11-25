import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import type { GetStaticProps, NextPage } from "next/types";
import { useEffect, useState } from "react";
import FormPage from "../../components/FormPage";
import { trpc } from "../../utils/api";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "follow"]),
	};
};

const Follow: NextPage = () => {
	const { t } = useTranslation("follow");

	// Get query params
	const router = useRouter();
	const email = [router.query.email].flat()[0];

	const mutation = trpc.follow.create.useMutation();

	const [follow, setFollow] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (mutation.error) {
			setError(mutation.error.message);
		}
	}, [mutation.error, t]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!email) return;

		mutation.mutate({
			email,
		});

		setFollow(true);
	};

	return (
		<FormPage
			onSubmit={handleSubmit}
			error={error}
			invalid={!email ? t("missing") : null}
			loading={false}
			path={"/follow"}
			user={null}
			title={t("")}
		>
			<h3 className="font-rubik text-[clamp(1rem,1vmin,5rem)] font-medium text-dark-color">
				{follow && !mutation.isLoading ? t("success", { email }) : t("confirm", { email })}
			</h3>
			{follow && !mutation.isLoading ? (
				<a
					className="hover:bg-medium cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light-color px-[calc(2*clamp(0.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-rubik text-[clamp(1rem,1vmin,5rem)] text-white shadow-md transition-all duration-1000"
					href="https://hackthehill.com"
					rel="noreferrer"
				>
					{t("home")}
				</a>
			) : (
				<button className="hover:bg-medium cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light-color px-[calc(2*clamp(0.75rem,1vmin,5rem))] py-[clamp(0.75rem,1vmin,5rem)] font-rubik text-[clamp(1rem,1vmin,5rem)] text-white shadow-md transition-all duration-1000">
					{t("follow")}
				</button>
			)}
		</FormPage>
	);
};

export default Follow;
