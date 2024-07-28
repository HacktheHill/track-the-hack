import { RoleName } from "@prisma/client";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { makeZodI18nMap } from "zod-i18n-map";

import { uploadResume } from "../../client/s3";
import App from "../../components/App";
import Page from "../../components/apply/Page";
import Error from "../../components/Error";
import Loading from "../../components/Loading";
import { trpc } from "../../server/api/api";
import type { ApplicationQuestionsType } from "../../server/lib/apply";
import { rolesRedirect } from "../../server/lib/redirects";
import { processFormData, saveToLocalStorage } from "../../utils/apply";
import { hackerSchema, pageSchemas } from "../../utils/common";
import { getAuthOptions } from "../api/auth/[...nextauth]";

type ApplyProps = {
	applicationQuestions: ApplicationQuestionsType[number][];
};

const Apply = ({ applicationQuestions }: ApplyProps) => {
	const { t } = useTranslation("apply");
	const router = useRouter();

	const errorMap = makeZodI18nMap({ t });

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [step, setStep] = useState<number>(0);
	const [formData, setFormData] = useState(new FormData());
	const formRef = useRef<HTMLFormElement>(null);
	const [errors, setErrors] = useState<Record<string, Record<string, string[]>>>({});

	const mutation = trpc.hackers.apply.useMutation();

	const validatePage = (page: ApplicationQuestionsType[number]) => {
		const ref = formRef.current;
		if (!ref) return false;

		const currentFormData = new FormData(ref);
		const updatedFormData = new FormData();

		formData.forEach((value, key) => updatedFormData.append(key, value));
		currentFormData.forEach((value, key) => updatedFormData.append(key, value));

		setFormData(updatedFormData);
		saveToLocalStorage(updatedFormData);

		const pageName = page.name;
		if (pageName in pageSchemas) {
			const pageData = processFormData(updatedFormData);
			const schema = pageSchemas[pageName as keyof typeof pageSchemas];
			const parseResult = schema.safeParse(pageData, { errorMap });

			if (parseResult.success) {
				setErrors(prevErrors => ({ ...prevErrors, [pageName]: {} }));
			} else {
				const newErrors = parseResult.error.flatten().fieldErrors;
				setErrors(prevErrors => ({ ...prevErrors, [pageName]: newErrors }));
				console.error(parseResult.error.message);
				return false;
			}
		}

		return true;
	};

	const validateAllPages = () => {
		let isValid = true;
		applicationQuestions.forEach(page => {
			if (!validatePage(page)) {
				isValid = false;
			}
		});
		return isValid;
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!validateAllPages()) {
			setError(t("invalid-form"));
			return;
		}

		const resume = formData.get("resume") as File | null;
		const data = {
			...processFormData(formData),
			hasResume: !!resume,
		};

		const parse = hackerSchema.safeParse(data, { errorMap });

		if (!parse.success) {
			setError(t("invalid-form"));
			console.error(parse.error.message);
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(false);

		try {
			const result = await mutation.mutateAsync(parse.data);
			if (result.presignedUrl && resume) {
				await uploadResume(result.presignedUrl, resume, resume.name);
			}
			localStorage.removeItem("applyFormData");
			setSuccess(true);
		} catch (err) {
			setError((err as Error).message ?? t("unknown-error"));
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const savedData = localStorage.getItem("applyFormData");
		if (savedData) {
			const parsedData = JSON.parse(savedData) as Record<string, FormDataEntryValue | FormDataEntryValue[]>;
			const newFormData = new FormData();
			Object.entries(parsedData).forEach(([key, value]) => {
				if (Array.isArray(value)) {
					value.forEach(v => newFormData.append(key, v));
				} else {
					newFormData.append(key, value);
				}
			});

			setFormData(newFormData);
		}
	}, []);

	return (
		<App className="overflow-y-auto bg-default-gradient" title={t("title")}>
			{(loading || error || success) && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-light-tertiary-color bg-opacity-90">
					<div className="w-full max-w-lg rounded border border-dark-primary-color bg-light-quaternary-color p-8 text-center">
						{loading && <Loading />}
						{error && (
							<>
								<Error message={error} />
								<button
									type="button"
									className="mt-4 whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
									onClick={() => setError(null)}
								>
									{t("return-to-form")}
								</button>
							</>
						)}
						{success && (
							<>
								<h3 className="text-4xl font-bold text-dark-color">{t("success")}</h3>
								<p>{t("application-submitted-successfully")}</p>
								<button
									type="button"
									className="mt-4 whitespace-nowrap rounded-lg border border-dark-primary-color bg-light-quaternary-color px-4 py-2 font-coolvetica text-sm text-dark-primary-color transition-colors hover:bg-light-tertiary-color short:text-base"
									onClick={() => void router.replace("/")}
								>
									{t("back-home")}
								</button>
							</>
						)}
					</div>
				</div>
			)}
			<form ref={formRef} onSubmit={e => void handleSubmit(e)}>
				{applicationQuestions.slice(0, step + 1).map((page, index) => (
					<Page
						key={page.name}
						page={page}
						formData={formData}
						index={index}
						isLastPage={index === applicationQuestions.length - 1}
						setStep={setStep}
						errors={errors[page.name] ?? {}}
						validatePage={validatePage}
					/>
				))}
			</form>
		</App>
	);
};

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
	const session = await getServerSession(req, res, getAuthOptions(req));
	return {
		redirect: await rolesRedirect(session, "/", [RoleName.ORGANIZER]),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["hacker", "navbar", "common"])),
		},
	};
};

export default Apply;
