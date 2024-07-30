import { Locale } from "@prisma/client";
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
import { getApplicationQuestions } from "../../server/lib/apply";
import { sessionRedirect } from "../../server/lib/redirects";
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
	const formRef = useRef<HTMLFormElement>(null);
	const formDataRef = useRef<FormData>(new FormData());

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [step, setStep] = useState<number>(0);
	const [errors, setErrors] = useState<Record<string, Record<string, string[]>>>({});

	const mutation = trpc.hackers.apply.useMutation();

	const updateFormData = () => {
		if (!formRef.current) return;
		const formElementData = new FormData(formRef.current);
		const updatedFormData = new FormData();

		formDataRef.current.forEach((value, key) => {
			if (key.endsWith("[]")) {
				updatedFormData.delete(key);
				formDataRef.current.getAll(key).forEach(v => updatedFormData.append(key, v));
			} else {
				updatedFormData.set(key, value);
			}
		});

		formElementData.forEach((value, key) => {
			if (key.endsWith("[]")) {
				updatedFormData.delete(key);
				formElementData.getAll(key).forEach(v => updatedFormData.append(key, v));
			} else {
				updatedFormData.set(key, value);
			}
		});

		formDataRef.current = updatedFormData;
		saveToLocalStorage(updatedFormData);
	};

	const validatePage = (page: ApplicationQuestionsType[number]) => {
		if (!formRef.current) return false;

		updateFormData();

		const pageName = page.name;
		if (pageName in pageSchemas) {
			const pageData = processFormData(formDataRef.current);
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

		updateFormData();

		if (!validateAllPages()) {
			setError(t("invalid-form"));
			return;
		}

		const resume = formDataRef.current.get("resume") as File | null;
		const data = {
			...processFormData(formDataRef.current),
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
			formDataRef.current = newFormData;
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
						formData={formDataRef.current}
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
		redirect: sessionRedirect(session, "/apply"),
		props: {
			...(await serverSideTranslations(locale ?? "en", ["apply", "zod", "navbar", "common"])),
			applicationQuestions: getApplicationQuestions(
				locale && locale in Locale ? (locale as keyof typeof Locale) : "EN",
			),
		},
	};
};

export default Apply;
