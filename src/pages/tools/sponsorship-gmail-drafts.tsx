import { Role } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps, NextPage } from "next/types";
import { useState } from "react";

import App from "../../components/App";
import Error from "../../components/Error";
import OnlyRole from "../../components/OnlyRole";

import { trpc } from "../../utils/api";
import { sponsorshipGmailDraftsSchema } from "../../utils/common";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "sponsorship-gmail-drafts"]),
	};
};

const SponsorshipGmailDrafts: NextPage = () => {
	const { t } = useTranslation("sponsorship-gmail-drafts");
	const { data: sessionData } = useSession();

	const mutation = trpc.tools.sponsorshipGmailDrafts.useMutation();

	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);

		const data = Object.fromEntries(formData) as Record<string, string | number | undefined>;

		// Remove empty values
		Object.keys(data).forEach(key => {
			if (data[key] == null || data[key] === "") {
				delete data[key];
			}
		});

		const parse = sponsorshipGmailDraftsSchema.safeParse(data);
		if (!parse.success) {
			setError(t("invalid-form"));
			console.error(parse.error);
		} else {
			mutation.mutate(parse.data);
			if (!mutation.error) {
				setError("");
				setSuccess(true);
				event.currentTarget.reset();
			} else {
				setError(mutation.error.message);
			}
		}
	};

	return (
		<App className="overflow-y-auto bg-gradient3 p-8 sm:p-12" title={t("title")}>
			<OnlyRole filter={role => role === Role.ORGANIZER}>
				{success ? (
					<div className="flex flex-col items-center gap-8">
						<h3 className="font-rubik text-4xl font-bold text-dark">{t("title")}</h3>
						<button
							className="cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light px-8 py-2 font-rubik text-white shadow-md transition-all duration-1000 hover:bg-background2"
							onClick={() => setSuccess(false)}
						>
							{t("new")}
						</button>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex flex-col items-center gap-8">
						<h3 className="font-rubik text-4xl font-bold text-dark">{t("title")}</h3>
						<div className="flex flex-col gap-4">
							<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<label htmlFor="organizer-full-name" className="flex-[50%] font-rubik text-dark">
									{t("organizer-full-name")}
								</label>
								<input
									id="organizer-full-name"
									name="organizerFullName"
									type="text"
									className="w-full rounded-[100px] border-none bg-background1 px-4 py-2 font-rubik text-dark shadow-md transition-all duration-500 hover:bg-background1/50"
									defaultValue={sessionData?.user?.name ?? ""}
								/>
							</div>
							<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<label htmlFor="company-name" className="flex-[50%] font-rubik text-dark">
									{t("company-name")}
									<span className="text-red-500"> *</span>
								</label>
								<input
									id="company-name"
									name="companyName"
									type="text"
									className="w-full rounded-[100px] border-none bg-background1 px-4 py-2 font-rubik text-dark shadow-md transition-all duration-500 hover:bg-background1/50"
									required
								/>
							</div>
							<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<label htmlFor="company-rep-name" className="flex-[50%] font-rubik text-dark">
									{t("company-rep-name")}
									<span className="text-red-500"> *</span>
								</label>
								<input
									id="company-rep-name"
									name="companyRepName"
									type="text"
									className="w-full rounded-[100px] border-none bg-background1 px-4 py-2 font-rubik text-dark shadow-md transition-all duration-500 hover:bg-background1/50"
									required
								/>
							</div>
							<div className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<label htmlFor="company-name" className="flex-[50%] font-rubik text-dark">
									{t("company-email")}
									<span className="text-red-500"> *</span>
								</label>
								<input
									id="company-email"
									name="companyEmail"
									type="email"
									className="w-full rounded-[100px] border-none bg-background1 px-4 py-2 font-rubik text-dark shadow-md transition-all duration-500 hover:bg-background1/50"
									required
								/>
							</div>
						</div>
						{error && (
							<div className="flex flex-col items-center gap-2">
								<p className="text-center font-rubik text-red-500">{error}</p>
							</div>
						)}
						<button className="cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light px-8 py-2 font-rubik text-white shadow-md transition-all duration-1000 hover:bg-medium">
							{t("submit")}
						</button>
					</form>
				)}
			</OnlyRole>
			{!sessionData?.user && (
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={t("not-authorized-to-view-this-page")} />
				</div>
			)}
		</App>
	);
};

export default SponsorshipGmailDrafts;
