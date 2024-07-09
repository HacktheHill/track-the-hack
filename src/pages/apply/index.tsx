import { Role } from "@prisma/client";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps, NextPage } from "next/types";
import { useEffect, useState } from "react";

import App from "../../components/App";
import Error from "../../components/Error";
import Filter from "../../components/Filter";

import { trpc } from "../../utils/api";
import { applySchema } from "../../utils/common";
import { useRouter } from "next/router";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "navbar", "apply"]),
	};
};

const Apply: NextPage = () => {
	const { t } = useTranslation("apply");
	const router = useRouter();

	const mutation = trpc.hackers.apply.useMutation();

	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		if (mutation.error) {
			setError(mutation.error.message);
		}
	}, [mutation.error, t]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);

		const data = Object.fromEntries(formData) as Record<string, string | number | undefined>;

		if (data.preferredLanguage === "en" || data.preferredLanguage === "fr") {
			data.preferredLanguage = data.preferredLanguage.toUpperCase();
		} else {
			data.preferredLanguage = undefined;
		}

		if (typeof data.graduationYear === "string") {
			data.graduationYear = parseInt(data.graduationYear);
			if (Number.isNaN(data.graduationYear)) {
				data.graduationYear = undefined;
			}
		}

		if (data.shirtSize === "") {
			data.shirtSize = undefined;
		}

		if (typeof data.numberOfPreviousHackathons === "string") {
			data.numberOfPreviousHackathons = parseInt(data.numberOfPreviousHackathons);
			if (Number.isNaN(data.numberOfPreviousHackathons)) {
				data.numberOfPreviousHackathons = undefined;
			}
		}

		const parse = applySchema.safeParse(data);
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

	const fields = [
		{
			name: "email",
			type: "email",
			required: true,
		},
		{
			name: "firstName",
			type: "text",
			required: true,
		},
		{
			name: "lastName",
			type: "text",
			required: true,
		},
		{
			name: "phoneNumber",
			type: "tel",
			required: true,
		},
		{
			name: "dietaryRestrictions",
			type: "text",
			required: false,
		},
		{
			name: "accessibilityRequirements",
			type: "text",
			required: false,
		},
		{
			name: "emergencyContactName",
			type: "text",
			required: true,
		},
		{
			name: "emergencyContactRelationship",
			type: "text",
			required: true,
		},
		{
			name: "emergencyContactPhoneNumber",
			type: "tel",
			required: true,
		},
		{
			name: "preferredLanguage",
			type: "select",
			options: ["en", "fr"],
			required: false,
		},
		{
			name: "gender",
			type: "text",
			required: false,
		},
		{
			name: "university",
			type: "text",
			required: false,
		},
		{
			name: "studyLevel",
			type: "text",
			required: false,
		},
		{
			name: "studyProgram",
			type: "text",
			required: false,
		},
		{
			name: "graduationYear",
			type: "number",
			required: false,
		},
		{
			name: "location",
			type: "text",
			required: false,
		},
		{
			name: "shirtSize",
			type: "select",
			options: ["S", "M", "L", "XL", "XXL"],
			required: false,
		},
		{
			name: "numberOfPreviousHackathons",
			type: "number",
			required: false,
		},
		{
			name: "linkGithub",
			type: "url",
			required: false,
		},
		{
			name: "linkLinkedin",
			type: "url",
			required: false,
		},
		{
			name: "linkPersonalSite",
			type: "url",
			required: false,
		},
	] as const;

	const patterns = {
		tel: "/^+?d{10,15}$/",
		url: undefined,
		number: "/^d+$/",
		email: undefined,
		text: undefined,
	} as const;

	return (
		<App className="overflow-y-auto bg-default-gradient p-8 sm:p-12" title={t("title")}>
			<Filter filter={role => role === Role.ORGANIZER}>
				{success ? (
					<div className="flex flex-col items-center gap-8">
						<h3 className="font-rubik text-4xl font-bold text-dark-color">{t("title")}</h3>
						<p>{t("success")}</p>
						<button
							className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
							onClick={() => void router.replace("/")}
						>
							{t("back")}
						</button>
					</div>
				) : (<form onSubmit={handleSubmit} className="flex flex-col items-center gap-8">
					<h3 className="font-rubik text-4xl font-bold text-dark-color">{t("title")}</h3>
					<div className="flex flex-col gap-4">
						{fields.map(field => (
							<div key={field.name} className="flex w-full flex-col items-center gap-2 sm:flex-row">
								<label htmlFor={field.name} className="flex-[50%] font-rubik text-dark-color">
									{t(field.name)}
									{field.required && <span className="text-red-500"> *</span>}
								</label>
								{field.type === "select" ? (
									<select
										id={field.name}
										name={field.name}
										className="w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
										required={field.required}
									>
										<option value="">{t("select")}</option>
										{field.options?.map(option => (
											<option key={option} value={option}>
												{t(option)}
											</option>
										))}
									</select>
								) : (
									<input
										id={field.name}
										name={field.name}
										type={field.type}
										className="w-full rounded-[100px] border-none bg-light-primary-color px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-light-primary-color/50"
										required={field.required}
										pattern={patterns[field.type]}
									/>
								)}
							</div>
						))}
					</div>
					{error && (
						<div className="flex flex-col items-center gap-2">
							<p className="text-center font-rubik text-red-500">{error}</p>
						</div>
					)}
					<button className="whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base">
						{t("submit")}
					</button>
				</form>
				)}
				<Error message={t("not-authorized-to-view-this-page")} />
			</Filter>
		</App>
	);
};

export default Apply;