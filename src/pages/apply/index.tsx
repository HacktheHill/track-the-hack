import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import type { GetServerSideProps, NextPage } from "next/types";
import { useEffect, useState } from "react";

import App from "../../components/App";
import { trpc } from "../../server/api/api";
import { fields, hackerSchema, patterns } from "../../utils/common";
import { sessionRedirect } from "../../server/lib/redirects";
import { getAuthOptions } from "../api/auth/[...nextauth]";
import { uploadResume } from "../../client/s3";

const processFormData = (formData: FormData) => {
	const data = Object.fromEntries(formData.entries()) as {
		[k: string]: FormDataEntryValue | number | File | undefined;
	};

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

	delete data.resume;

	return data;
};

const Apply: NextPage = () => {
	const { t } = useTranslation("apply");
	const router = useRouter();

	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const mutation = trpc.hackers.apply.useMutation();

	useEffect(() => {
		if (mutation.error) {
			setError(mutation.error.message);
		}
	}, [mutation.error, t]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const data = processFormData(formData);

		const parse = hackerSchema.safeParse(data);
		if (!parse.success) {
			setError(t("invalid-form"));
			console.error(parse.error.message);
		} else {
			const result = await mutation.mutateAsync(parse.data);
			const resume = formData.get("resume") as File;
			if (result.presignedUrl && resume) {
				await uploadResume(result.presignedUrl, resume, resume.name);
			}

			if (!mutation.error) {
				setError("");
				setSuccess(true);
				event.currentTarget?.reset();
			} else {
				setError(mutation.error.message);
			}
		}
	};

	return (
		<App className="overflow-y-auto bg-default-gradient p-8 sm:p-12" title={t("title")}>
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
			) : (
				<form onSubmit={e => void handleSubmit(e)} className="flex flex-col items-center gap-8">
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
										accept={field.type === "file" ? "application/pdf" : undefined}
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
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: sessionRedirect(session, "/apply"),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["apply", "navbar", "common"])),
		},
	};
};

export default Apply;
