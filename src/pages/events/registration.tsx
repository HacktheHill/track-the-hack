import { Role } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps, NextPage } from "next/types";
import { useEffect, useState } from "react";

import App from "../../components/App";
import Error from "../../components/Error";
import OnlyRole from "../../components/OnlyRole";
import QRCode from "../../components/QRCode";
import { useRouter } from "next/router";
import { trpc } from "../../utils/api";
import { walkInSchema } from "../../utils/common";

export const getStaticProps: GetStaticProps = async ({ locale }) => {
	return {
		props: await serverSideTranslations(locale ?? "en", ["common", "registration"]),
	};
};

const Registration : NextPage = () => {
	const { t } = useTranslation("registration");
	const { data: sessionData } = useSession();
	const id = sessionData?.user?.id;
	const router = useRouter();
	const mutation = trpc.hackers.walkIn.useMutation();

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

		const parse = walkInSchema.safeParse(data);
		if (!parse.success) {
			setError(t("invalid-form"));
			console.error(parse.error);
		} else {



			mutation.mutate({...parse.data, userId: id});
			if (!mutation.error) {
				setError("");
				setSuccess(true);
				event.currentTarget.reset();

				void router.back();
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
			<OnlyRole filter={role => role === Role.HACKER || role === Role.ORGANIZER}>
					<form onSubmit={handleSubmit} className="flex flex-col items-center gap-8">
						<h3 className="font-rubik text-4xl font-bold text-dark-color">{t("title")}</h3>
						<div className="flex flex-col gap-4">
							{fields.map(field => (
								<div key={field.name} className="flex w-full flex-col items-center gap-2 sm:flex-row">
									<label htmlFor={field.name} className="flex-[50%] font-rubik text-dark-color">
										{t(field.name)}
										{field.required && <span className="text-white"> (Required) </span>}
									</label>
									{field.type === "select" ? (
										<select
											id={field.name}
											name={field.name}
											className="w-full rounded-[100px] border-none bg-light-secondary-color px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-medium-secondary-color"
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
											className="w-full rounded-[100px] border-none bg-light-secondary-color px-4 py-2 font-rubik text-dark-color shadow-md transition-all duration-500 hover:bg-medium-secondary-color"
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
						<button className="hover:bg-medium cursor-pointer whitespace-nowrap rounded-[100px] border-none bg-light-color px-8 py-2 font-rubik shadow-md transition-all duration-1000">
							{t("submit")}
						</button>
					</form>
			</OnlyRole>
			{!sessionData?.user && (
				<div className="flex flex-col items-center justify-center gap-4">
					<Error message={t("not-authorized-to-view-this-page")} />
				</div>
			)}
		</App>
	);
};

export default Registration;
